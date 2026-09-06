/**
 * E2E del modulo de productos y catalogos (Fase 4).
 * Requiere PostgreSQL accesible (`pnpm db:up`).
 *
 * Cubre los casos exigidos: crear producto, codigo interno duplicado en el
 * mismo tenant, mismo codigo en tenants distintos, barcode duplicado, aislamiento
 * entre tenants, permiso denegado, edicion, desactivacion, factor / precio
 * invalidos, mas de una presentacion principal, busqueda tenant-aware, generacion
 * concurrente de codigos, cambio de precio (con y sin permiso) + auditoria, y
 * limite MAX_PRODUCTS del plan.
 */
/* oxlint-disable no-await-in-loop -- el fixture inserta en serie por dependencias de FK */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PERMISSION_CATALOG } from '../src/authz/permissions.catalog.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const MARK = '__producte2e__';
const EMAIL_DOMAIN = 'producte2e.local';
const PASSWORD = 'Secret123!';
const email = (local: string): string => `${local}@${EMAIL_DOMAIN}`.toLowerCase();

const ALL_PRODUCT_PERMS = [
  'products.read',
  'products.create',
  'products.update',
  'products.activate',
  'products.deactivate',
  'products.manage_units',
  'products.manage_presentations',
  'products.change_price',
];

interface Ids {
  tenantA: string;
  tenantB: string;
  tenantL: string;
  unitA: string;
  unitB: string;
  unitL: string;
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

  async function makePlan(suffix: string, maxProducts: number | null): Promise<string> {
    const plan = await prisma.plan.create({
      data: { code: `${MARK}${suffix}`, name: `${MARK}${suffix}`, price: 0 },
    });
    if (maxProducts !== null) {
      await prisma.planLimit.create({
        data: { planId: plan.id, key: 'MAX_PRODUCTS', value: maxProducts },
      });
    }
    return plan.id;
  }

  async function makeTenant(suffix: string, planId: string): Promise<{ tenantId: string; unitId: string }> {
    const tenant = await prisma.tenant.create({
      data: { name: `${MARK}${suffix}`, status: 'ACTIVE', baseCurrency: 'HNL' },
    });
    const now = new Date();
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId,
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

  async function makeUser(
    local: string,
    tenantId: string,
    permissions: string[],
  ): Promise<void> {
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

  const planFree = await makePlan('planfree', null);
  const planLimited = await makePlan('planlimited', 1);

  const a = await makeTenant('A', planFree);
  const b = await makeTenant('B', planFree);
  const l = await makeTenant('L', planLimited);

  await makeUser('ownerA', a.tenantId, ALL_PRODUCT_PERMS);
  await makeUser('viewerA', a.tenantId, ['products.read']);
  await makeUser('noPriceA', a.tenantId, [
    'products.read',
    'products.create',
    'products.manage_presentations',
  ]);
  await makeUser('ownerB', b.tenantId, ALL_PRODUCT_PERMS);
  await makeUser('ownerL', l.tenantId, ALL_PRODUCT_PERMS);

  return {
    tenantA: a.tenantId,
    tenantB: b.tenantId,
    tenantL: l.tenantId,
    unitA: a.unitId,
    unitB: b.unitId,
    unitL: l.unitId,
  };
}

async function cleanup(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ where: { name: { startsWith: MARK } } });
  const tenantIds = tenants.map((t) => t.id);
  const users = await prisma.user.findMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  const userIds = users.map((u) => u.id);
  const roles = await prisma.role.findMany({ where: { tenantId: { in: tenantIds } } });
  const roleIds = roles.map((r) => r.id);

  await prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.productPresentation.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantProductSequence.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.category.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.brand.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

describe('Crear producto', () => {
  it('crea un producto y autogenera el codigo interno FER-000001', async () => {
    const cookie = await login('ownerA');
    const res = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Taladro percutor', baseUnitId: ids.unitA })
      .expect(201);
    expect(res.body.internalCode).toMatch(/^FER-\d{6}$/);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('crea un producto con presentaciones y marca la primera como principal', async () => {
    const cookie = await login('ownerA');
    const res = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({
        name: 'Cemento gris',
        baseUnitId: ids.unitA,
        presentations: [
          { name: 'Libra', unitId: ids.unitA, conversionFactor: '1', salePrice: '5.00' },
          { name: 'Bolsa', unitId: ids.unitA, conversionFactor: '50', salePrice: '245.00' },
        ],
      })
      .expect(201);
    const defaults = res.body.presentations.filter((p: { isDefault: boolean }) => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].name).toBe('Libra');
  });

  it('rechaza mas de una presentacion principal -> 422', async () => {
    const cookie = await login('ownerA');
    const res = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({
        name: 'Producto dos principales',
        baseUnitId: ids.unitA,
        presentations: [
          { name: 'A', unitId: ids.unitA, conversionFactor: '1', salePrice: '1', isDefault: true },
          { name: 'B', unitId: ids.unitA, conversionFactor: '2', salePrice: '2', isDefault: true },
        ],
      })
      .expect(422);
    expect(res.body.code).toBe('INVALID_PRESENTATION');
  });

  it('rechaza factor de conversion no positivo -> 422', async () => {
    const cookie = await login('ownerA');
    const res = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({
        name: 'Producto factor cero',
        baseUnitId: ids.unitA,
        presentations: [{ name: 'X', unitId: ids.unitA, conversionFactor: '0', salePrice: '1' }],
      })
      .expect(422);
    expect(res.body.code).toBe('INVALID_PRESENTATION');
  });

  it('rechaza precio invalido -> 400 VALIDATION_ERROR', async () => {
    const cookie = await login('ownerA');
    const res = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({
        name: 'Producto precio malo',
        baseUnitId: ids.unitA,
        presentations: [{ name: 'X', unitId: ids.unitA, conversionFactor: '1', salePrice: '-5' }],
      })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('usuario sin products.create -> 403 PERMISSION_DENIED', async () => {
    const cookie = await login('viewerA');
    const res = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'No permitido', baseUnitId: ids.unitA })
      .expect(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });
});

describe('Unicidad de codigos', () => {
  it('codigo interno duplicado en el mismo tenant -> 409 PRODUCT_CODE_TAKEN', async () => {
    const cookie = await login('ownerA');
    await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Con codigo', internalCode: 'DUP-001', baseUnitId: ids.unitA })
      .expect(201);
    const res = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Con codigo repetido', internalCode: 'DUP-001', baseUnitId: ids.unitA })
      .expect(409);
    expect(res.body.code).toBe('PRODUCT_CODE_TAKEN');
  });

  it('el mismo codigo interno es valido en tenants distintos', async () => {
    const cookieA = await login('ownerA');
    const cookieB = await login('ownerB');
    await api()
      .post('/api/products')
      .set('Cookie', cookieA)
      .send({ name: 'Cross A', internalCode: 'CROSS-1', baseUnitId: ids.unitA })
      .expect(201);
    await api()
      .post('/api/products')
      .set('Cookie', cookieB)
      .send({ name: 'Cross B', internalCode: 'CROSS-1', baseUnitId: ids.unitB })
      .expect(201);
  });

  it('barcode duplicado en el mismo tenant -> 409 PRODUCT_BARCODE_TAKEN', async () => {
    const cookie = await login('ownerA');
    await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Barcode 1', barcode: '7500000000001', baseUnitId: ids.unitA })
      .expect(201);
    const res = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Barcode 2', barcode: '7500000000001', baseUnitId: ids.unitA })
      .expect(409);
    expect(res.body.code).toBe('PRODUCT_BARCODE_TAKEN');
  });

  it('genera codigos distintos bajo creaciones concurrentes', async () => {
    const cookie = await login('ownerA');
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        api()
          .post('/api/products')
          .set('Cookie', cookie)
          .send({ name: `Concurrente ${i}`, baseUnitId: ids.unitA }),
      ),
    );
    const codes = results.map((r) => r.body.internalCode as string);
    for (const r of results) {
      expect(r.status).toBe(201);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('Aislamiento entre tenants', () => {
  it('un producto de A no es visible ni editable desde B -> 404', async () => {
    const cookieA = await login('ownerA');
    const cookieB = await login('ownerB');
    const created = await api()
      .post('/api/products')
      .set('Cookie', cookieA)
      .send({ name: 'Solo de A', baseUnitId: ids.unitA })
      .expect(201);
    const id = created.body.id as string;

    const get = await api().get(`/api/products/${id}`).set('Cookie', cookieB).expect(404);
    expect(get.body.code).toBe('NOT_FOUND');
    await api()
      .patch(`/api/products/${id}`)
      .set('Cookie', cookieB)
      .send({ name: 'Intruso' })
      .expect(404);
  });

  it('la busqueda solo alcanza al tenant activo', async () => {
    const cookieA = await login('ownerA');
    const cookieB = await login('ownerB');
    await api()
      .post('/api/products')
      .set('Cookie', cookieA)
      .send({ name: 'Esmeril angular unico', baseUnitId: ids.unitA })
      .expect(201);

    const fromA = await api()
      .get('/api/products?search=esmeril%20angular')
      .set('Cookie', cookieA)
      .expect(200);
    expect(fromA.body.total).toBe(1);

    const fromB = await api()
      .get('/api/products?search=esmeril%20angular')
      .set('Cookie', cookieB)
      .expect(200);
    expect(fromB.body.total).toBe(0);
  });
});

describe('Edicion y estado', () => {
  it('edita el nombre de un producto', async () => {
    const cookie = await login('ownerA');
    const created = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Nombre viejo', baseUnitId: ids.unitA })
      .expect(201);
    const res = await api()
      .patch(`/api/products/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ name: 'Nombre nuevo' })
      .expect(200);
    expect(res.body.name).toBe('Nombre nuevo');
  });

  it('desactiva un producto y desaparece del listado de activos', async () => {
    const cookie = await login('ownerA');
    const created = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Para desactivar', baseUnitId: ids.unitA })
      .expect(201);
    await api()
      .post(`/api/products/${created.body.id}/deactivate`)
      .set('Cookie', cookie)
      .expect(201);

    const active = await api()
      .get('/api/products?search=Para%20desactivar&status=ACTIVE')
      .set('Cookie', cookie)
      .expect(200);
    expect(active.body.total).toBe(0);

    const inactive = await api()
      .get('/api/products?search=Para%20desactivar&status=INACTIVE')
      .set('Cookie', cookie)
      .expect(200);
    expect(inactive.body.total).toBe(1);
  });
});

describe('Cambio de precio', () => {
  it('sin products.change_price -> 403; con permiso -> 200 y auditoria', async () => {
    const owner = await login('ownerA');
    const created = await api()
      .post('/api/products')
      .set('Cookie', owner)
      .send({
        name: 'Con precio',
        baseUnitId: ids.unitA,
        presentations: [{ name: 'Unidad', unitId: ids.unitA, conversionFactor: '1', salePrice: '10.00' }],
      })
      .expect(201);
    const productId = created.body.id as string;
    const presentationId = created.body.presentations[0].id as string;

    const noPrice = await login('noPriceA');
    const denied = await api()
      .post(`/api/products/${productId}/presentations/${presentationId}/price`)
      .set('Cookie', noPrice)
      .send({ salePrice: '12.00' })
      .expect(403);
    expect(denied.body.code).toBe('PERMISSION_DENIED');

    const ok = await api()
      .post(`/api/products/${productId}/presentations/${presentationId}/price`)
      .set('Cookie', owner)
      .send({ salePrice: '12.50', reason: 'ajuste' })
      .expect(201);
    expect(ok.body.salePrice).toBe('12.5');

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: ids.tenantA, action: 'PRODUCT_PRICE_CHANGED', entityId: presentationId },
    });
    expect(audit).not.toBeNull();
    const metadata = audit?.metadata as { newPrice: string; previousPrice: string };
    expect(metadata.newPrice).toBe('12.50');
    expect(metadata.previousPrice).toBe('10');
  });
});

describe('Limite del plan', () => {
  it('MAX_PRODUCTS alcanzado -> 409 PLAN_LIMIT_REACHED', async () => {
    const cookie = await login('ownerL');
    await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Unico permitido', baseUnitId: ids.unitL })
      .expect(201);
    const res = await api()
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Excede el plan', baseUnitId: ids.unitL })
      .expect(409);
    expect(res.body.code).toBe('PLAN_LIMIT_REACHED');
  });
});
