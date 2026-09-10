/**
 * E2E del modulo de inventario (Fase 5).
 * Requiere PostgreSQL accesible (`pnpm db:up`).
 *
 * Cubre los casos exigidos: balance inicial en cero, incremento, decremento,
 * ajuste positivo / negativo, intento de stock negativo, forma del movimiento,
 * resultingQuantity correcto, permiso denegado, aislamiento entre tenants,
 * kardex del tenant, cantidades decimales, DOS OPERACIONES CONCURRENTES sobre la
 * misma existencia, rollback si falla el movimiento, e imposibilidad de fijar el
 * stock directamente.
 */
/* oxlint-disable no-await-in-loop -- el fixture inserta en serie por dependencias de FK */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PERMISSION_CATALOG } from '../src/authz/permissions.catalog.js';
import { recordMovementWithinTx } from '../src/inventory/inventory.core.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const MARK = '__invente2e__';
const EMAIL_DOMAIN = 'invente2e.local';
const PASSWORD = 'Secret123!';
const email = (local: string): string => `${local}@${EMAIL_DOMAIN}`.toLowerCase();

const ADJUSTER_PERMS = [
  'products.read',
  'products.create',
  'inventory.read',
  'inventory.kardex',
  'inventory.adjust',
  'products.change_cost',
];

interface Ids {
  tenantA: string;
  tenantB: string;
  unitA: string;
  unitB: string;
}

let app: INestApplication;
let prisma: PrismaService;
let ids: Ids;

async function seedFixture(): Promise<Ids> {
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: { code: p.code, module: p.module, description: p.description },
      update: {},
    });
  }
  const permIdByCode = new Map(
    (await prisma.permission.findMany()).map((p) => [p.code, p.id] as const),
  );
  const passwordHash = await bcrypt.hash(PASSWORD, 4);

  const plan = await prisma.plan.create({
    data: { code: `${MARK}plan`, name: `${MARK}plan`, price: 0 },
  });

  async function makeTenant(suffix: string): Promise<{ tenantId: string; unitId: string }> {
    const tenant = await prisma.tenant.create({
      data: { name: `${MARK}${suffix}`, status: 'ACTIVE', baseCurrency: 'HNL' },
    });
    const now = new Date();
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
    });
    const unit = await prisma.unit.create({
      data: { tenantId: tenant.id, code: 'UNIDAD', name: 'Unidad', status: 'ACTIVE' },
    });
    return { tenantId: tenant.id, unitId: unit.id };
  }

  async function makeUser(local: string, tenantId: string, permissions: string[]): Promise<void> {
    const role = await prisma.role.create({
      data: { tenantId, name: `${MARK}${local}`, isSystem: false },
    });
    await prisma.rolePermission.createMany({
      data: permissions.map((code) => ({ roleId: role.id, permissionId: permIdByCode.get(code)! })),
    });
    const user = await prisma.user.create({
      data: { name: local, email: email(local), passwordHash, status: 'ACTIVE' },
    });
    await prisma.tenantMembership.create({
      data: { tenantId, userId: user.id, roleId: role.id, status: 'ACTIVE' },
    });
  }

  const a = await makeTenant('A');
  const b = await makeTenant('B');
  await makeUser('adjA', a.tenantId, ADJUSTER_PERMS);
  await makeUser('viewA', a.tenantId, ['inventory.read', 'products.read', 'products.create']);
  await makeUser('adjB', b.tenantId, ADJUSTER_PERMS);

  return { tenantA: a.tenantId, tenantB: b.tenantId, unitA: a.unitId, unitB: b.unitId };
}

async function cleanup(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ where: { name: { startsWith: MARK } } });
  const tenantIds = tenants.map((t) => t.id);
  const users = await prisma.user.findMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  const userIds = users.map((u) => u.id);
  const roles = await prisma.role.findMany({ where: { tenantId: { in: tenantIds } } });
  const roleIds = roles.map((r) => r.id);

  await prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.inventoryAdjustment.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.productPresentation.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantProductSequence.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.unit.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
  await prisma.role.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: MARK } } });
}

function cookieFrom(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c: string) => c.split(';')[0]).join('; ');
}

const api = (): request.Agent => request(app.getHttpServer());

async function login(local: string): Promise<string> {
  const res = await api()
    .post('/api/auth/login')
    .send({ email: email(local), password: PASSWORD })
    .expect(200);
  return cookieFrom(res);
}

async function createProduct(cookie: string, unitId: string, name: string): Promise<string> {
  const res = await api()
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name, baseUnitId: unitId })
    .expect(201);
  return res.body.id as string;
}

function adjust(
  cookie: string,
  productId: string,
  direction: 'IN' | 'OUT',
  quantity: string,
): request.Test {
  return api()
    .post('/api/inventory/adjustments')
    .set('Cookie', cookie)
    .send({ productId, direction, quantity, reason: `test ${direction} ${quantity}` });
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  prisma = app.get(PrismaService);
  await cleanup();
  ids = await seedFixture();
}, 60_000);

afterAll(async () => {
  if (prisma) {
    await cleanup();
  }
  await app?.close();
});

describe('Existencia inicial', () => {
  it('un producto nuevo tiene existencia 0 y costo 0', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Producto en cero');
    const res = await api().get(`/api/inventory/products/${id}`).set('Cookie', cookie).expect(200);
    expect(res.body.quantity).toBe('0');
    expect(res.body.averageCost).toBe('0');
  });

  it('aparece en el listado con existencia 0', async () => {
    const cookie = await login('adjA');
    await createProduct(cookie, ids.unitA, 'Listado cero unico');
    const res = await api()
      .get('/api/inventory?search=Listado%20cero%20unico')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].quantity).toBe('0');
  });
});

describe('Ajustes', () => {
  it('ajuste positivo: sube la existencia, crea movimiento + InventoryAdjustment + auditoria', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Ajuste positivo');
    const res = await adjust(cookie, id, 'IN', '30').expect(201);
    expect(res.body.previousQuantity).toBe('0');
    expect(res.body.resultingQuantity).toBe('30');

    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: ids.tenantA, productId: id },
    });
    expect(movement.type).toBe('ADJUSTMENT_IN');
    expect(movement.baseQuantity.toString()).toBe('30');
    expect(movement.previousQuantity.toString()).toBe('0');
    expect(movement.resultingQuantity.toString()).toBe('30');
    expect(movement.unitId).toBe(ids.unitA);
    expect(movement.userId).not.toBeNull();
    expect(movement.reason).toContain('test IN');

    const adjustment = await prisma.inventoryAdjustment.findUniqueOrThrow({
      where: { movementId: movement.id },
    });
    expect(adjustment.direction).toBe('IN');
    expect(adjustment.quantity.toString()).toBe('30');

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: ids.tenantA, action: 'INVENTORY_ADJUSTED', entityId: adjustment.id },
    });
    expect(audit).not.toBeNull();
  });

  it('ajuste negativo: baja la existencia y guarda baseQuantity negativo', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Ajuste negativo');
    await adjust(cookie, id, 'IN', '50').expect(201);
    const res = await adjust(cookie, id, 'OUT', '20').expect(201);
    expect(res.body.resultingQuantity).toBe('30');

    const out = await prisma.inventoryMovement.findFirst({
      where: { tenantId: ids.tenantA, productId: id, type: 'ADJUSTMENT_OUT' },
    });
    expect(out?.baseQuantity.toString()).toBe('-20');
    expect(out?.resultingQuantity.toString()).toBe('30');
  });

  it('resultingQuantity encadena correctamente una secuencia de ajustes', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Secuencia');
    await adjust(cookie, id, 'IN', '100').expect(201);
    await adjust(cookie, id, 'OUT', '40').expect(201);
    const last = await adjust(cookie, id, 'IN', '10').expect(201);
    expect(last.body.previousQuantity).toBe('60');
    expect(last.body.resultingQuantity).toBe('70');

    const final = await api()
      .get(`/api/inventory/products/${id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(final.body.quantity).toBe('70');
  });

  it('cantidades decimales: aritmetica exacta', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Decimales');
    await adjust(cookie, id, 'IN', '1.5').expect(201);
    const res = await adjust(cookie, id, 'IN', '0.25').expect(201);
    expect(res.body.resultingQuantity).toBe('1.75');
  });

  it('intento de stock negativo: 422 INSUFFICIENT_STOCK y la existencia no cambia', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Sin stock');
    await adjust(cookie, id, 'IN', '5').expect(201);
    const res = await adjust(cookie, id, 'OUT', '8').expect(422);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');

    const after = await api()
      .get(`/api/inventory/products/${id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(after.body.quantity).toBe('5');
  });

  it('usuario sin inventory.adjust: 403 PERMISSION_DENIED', async () => {
    const owner = await login('adjA');
    const id = await createProduct(owner, ids.unitA, 'Protegido');
    const viewer = await login('viewA');
    const res = await api()
      .post('/api/inventory/adjustments')
      .set('Cookie', viewer)
      .send({ productId: id, direction: 'IN', quantity: '1', reason: 'no permitido' })
      .expect(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('motivo obligatorio: 400 VALIDATION_ERROR', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Sin motivo');
    const res = await api()
      .post('/api/inventory/adjustments')
      .set('Cookie', cookie)
      .send({ productId: id, direction: 'IN', quantity: '1' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('Cambio manual de costo', () => {
  it('fija el averageCost, audita valor anterior/nuevo y no toca la existencia', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Costo manual');
    await adjust(cookie, id, 'IN', '10').expect(201);

    const res = await api()
      .post(`/api/inventory/products/${id}/cost`)
      .set('Cookie', cookie)
      .send({ averageCost: '12.3456', reason: 'valoracion inicial' })
      .expect(201);
    expect(res.body.averageCost).toBe('12.3456');
    expect(res.body.quantity).toBe('10');

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: ids.tenantA, action: 'PRODUCT_COST_CHANGED', entityId: id },
    });
    const meta = audit?.metadata as { previousCost: string; newCost: string };
    expect(meta.newCost).toBe('12.345600');
    expect(meta.previousCost).toBe('0.000000');

    // no se genero ningun movimiento por el cambio de costo
    const moves = await prisma.inventoryMovement.count({
      where: { tenantId: ids.tenantA, productId: id },
    });
    expect(moves).toBe(1);
  });
});

describe('Kardex', () => {
  it('lista los movimientos del producto con entrada/salida/saldo', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Kardex producto');
    await adjust(cookie, id, 'IN', '100').expect(201);
    await adjust(cookie, id, 'OUT', '30').expect(201);

    const res = await api()
      .get(`/api/inventory/products/${id}/kardex`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.total).toBe(2);
    const [salida, entrada] = res.body.items; // orden desc por fecha
    expect(entrada.entrada).toBe('100');
    expect(entrada.salida).toBe('0');
    expect(salida.salida).toBe('30');
    expect(salida.saldo).toBe('70');
  });

  it('filtra por tipo de movimiento', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Kardex filtro');
    await adjust(cookie, id, 'IN', '10').expect(201);
    await adjust(cookie, id, 'OUT', '4').expect(201);
    const res = await api()
      .get(`/api/inventory/products/${id}/kardex?type=ADJUSTMENT_OUT`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].type).toBe('ADJUSTMENT_OUT');
  });
});

describe('Aislamiento entre tenants', () => {
  it('B no ve, ajusta ni consulta el kardex de un producto de A', async () => {
    const cookieA = await login('adjA');
    const cookieB = await login('adjB');
    const id = await createProduct(cookieA, ids.unitA, 'Solo de A inv');
    await adjust(cookieA, id, 'IN', '10').expect(201);

    await api().get(`/api/inventory/products/${id}`).set('Cookie', cookieB).expect(404);
    await api().get(`/api/inventory/products/${id}/kardex`).set('Cookie', cookieB).expect(404);
    const res = await api()
      .post('/api/inventory/adjustments')
      .set('Cookie', cookieB)
      .send({ productId: id, direction: 'IN', quantity: '1', reason: 'intruso' })
      .expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('el listado y el kardex solo alcanzan al tenant activo', async () => {
    const cookieA = await login('adjA');
    const cookieB = await login('adjB');
    const idA = await createProduct(cookieA, ids.unitA, 'Cruce inventario xyz');
    await adjust(cookieA, idA, 'IN', '7').expect(201);

    const fromA = await api()
      .get('/api/inventory?search=Cruce%20inventario%20xyz')
      .set('Cookie', cookieA)
      .expect(200);
    expect(fromA.body.total).toBe(1);

    const fromB = await api()
      .get('/api/inventory?search=Cruce%20inventario%20xyz')
      .set('Cookie', cookieB)
      .expect(200);
    expect(fromB.body.total).toBe(0);
  });
});

describe('Concurrencia', () => {
  it('N salidas simultaneas no pueden dejar la existencia negativa', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Concurrencia stock');
    await adjust(cookie, id, 'IN', '100').expect(201);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => adjust(cookie, id, 'OUT', '30')),
    );
    const ok = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 422);
    expect(ok.length + rejected.length).toBe(6); // ningun 500
    for (const r of rejected) {
      expect(r.body.code).toBe('INSUFFICIENT_STOCK');
    }
    // como mucho 3 salidas de 30 caben en 100
    expect(ok.length).toBe(3);

    const balance = await prisma.inventoryBalance.findUniqueOrThrow({
      where: { tenantId_productId: { tenantId: ids.tenantA, productId: id } },
    });
    expect(balance.quantity.toString()).toBe('10');
    expect(balance.quantity.gte(0)).toBe(true);

    // el saldo posterior de cada movimiento exitoso es monotono y nunca < 0
    const moves = await prisma.inventoryMovement.findMany({
      where: { tenantId: ids.tenantA, productId: id, type: 'ADJUSTMENT_OUT' },
    });
    for (const m of moves) {
      expect(m.resultingQuantity.gte(0)).toBe(true);
    }
  });
});

describe('Integridad transaccional', () => {
  it('si la transaccion falla despues del movimiento, el balance no cambia (rollback)', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Rollback');
    await adjust(cookie, id, 'IN', '40').expect(201);

    const before = await prisma.inventoryBalance.findUniqueOrThrow({
      where: { tenantId_productId: { tenantId: ids.tenantA, productId: id } },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await recordMovementWithinTx(tx, {
          tenantId: ids.tenantA,
          productId: id,
          type: 'ADJUSTMENT_IN',
          quantity: '5',
          unitId: ids.unitA,
          baseQuantityDelta: '5',
          reason: '__rollback__',
        });
        throw new Error('fallo simulado tras el movimiento');
      }),
    ).rejects.toThrow('fallo simulado');

    const after = await prisma.inventoryBalance.findUniqueOrThrow({
      where: { tenantId_productId: { tenantId: ids.tenantA, productId: id } },
    });
    expect(after.quantity.toString()).toBe(before.quantity.toString());
    const orphan = await prisma.inventoryMovement.count({
      where: { tenantId: ids.tenantA, productId: id, reason: '__rollback__' },
    });
    expect(orphan).toBe(0);
  });
});

describe('No se puede fijar el stock directamente', () => {
  it('el endpoint de costo rechaza un campo quantity y no altera la existencia', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Stock directo');
    await adjust(cookie, id, 'IN', '10').expect(201);

    await api()
      .post(`/api/inventory/products/${id}/cost`)
      .set('Cookie', cookie)
      .send({ averageCost: '5', reason: 'intento', quantity: '9999' })
      .expect(400);

    const after = await api()
      .get(`/api/inventory/products/${id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(after.body.quantity).toBe('10');
  });

  it('no existe PATCH sobre inventario', async () => {
    const cookie = await login('adjA');
    const id = await createProduct(cookie, ids.unitA, 'Sin patch');
    await api()
      .patch(`/api/inventory/products/${id}`)
      .set('Cookie', cookie)
      .send({ quantity: '100' })
      .expect(404);
  });
});
