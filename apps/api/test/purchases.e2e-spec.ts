/**
 * E2E del modulo de proveedores + compras (Fase 6).
 * Requiere PostgreSQL accesible (`pnpm db:up`).
 *
 * Cubre los casos exigidos por el prompt de la fase:
 *   crear proveedor, aislamiento de proveedores entre tenants, crear compra
 *   DRAFT, editar DRAFT, DRAFT no modifica inventario, completar compra,
 *   incremento de existencia, conversion presentacion -> unidad base, costo por
 *   unidad base, promedio ponderado, compra con stock inicial cero, multiples
 *   items, calculo backend del total, usuario sin purchases.complete, tenant
 *   incorrecto, doble finalizacion, rollback si falla un item, cancelacion
 *   valida, cancelacion duplicada, cancelacion que dejaria stock negativo, y
 *   relacion de los movimientos de inventario (referenceType / referenceId).
 *   Incluye aritmetica decimal.
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

const MARK = '__purchasee2e__';
const EMAIL_DOMAIN = 'purchasee2e.local';
const PASSWORD = 'Secret123!';
const email = (local: string): string => `${local}@${EMAIL_DOMAIN}`.toLowerCase();

const BUYER_PERMS = [
  'products.read',
  'products.create',
  'products.manage_presentations',
  'inventory.read',
  'inventory.kardex',
  'inventory.adjust',
  'suppliers.read',
  'suppliers.create',
  'suppliers.update',
  'suppliers.deactivate',
  'purchases.read',
  'purchases.create',
  'purchases.update',
  'purchases.complete',
  'purchases.cancel',
];
const NO_COMPLETE_PERMS = [
  'products.read',
  'suppliers.read',
  'purchases.read',
  'purchases.create',
  'purchases.update',
];

interface Ids {
  tenantA: string;
  tenantB: string;
  libraA: string;
  bolsaA: string;
  libraB: string;
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

  async function makeTenant(
    suffix: string,
  ): Promise<{ tenantId: string; libra: string; bolsa: string }> {
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
    const libra = await prisma.unit.create({
      data: { tenantId: tenant.id, code: 'LIBRA', name: 'Libra', status: 'ACTIVE' },
    });
    const bolsa = await prisma.unit.create({
      data: { tenantId: tenant.id, code: 'BOLSA', name: 'Bolsa', status: 'ACTIVE' },
    });
    return { tenantId: tenant.id, libra: libra.id, bolsa: bolsa.id };
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
  await makeUser('buyerA', a.tenantId, BUYER_PERMS);
  await makeUser('noCompleteA', a.tenantId, NO_COMPLETE_PERMS);
  await makeUser('buyerB', b.tenantId, BUYER_PERMS);

  return {
    tenantA: a.tenantId,
    tenantB: b.tenantId,
    libraA: a.libra,
    bolsaA: a.bolsa,
    libraB: b.libra,
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
  await prisma.purchaseItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.purchase.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.supplier.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

/** Producto en LIBRA. Si `bolsaFactor` se pasa, agrega una presentacion "Bolsa". */
async function createProduct(
  cookie: string,
  libraId: string,
  name: string,
  bolsa?: { unitId: string; factor: string },
): Promise<{ productId: string; presentationId: string | null }> {
  const body: Record<string, unknown> = { name, baseUnitId: libraId };
  if (bolsa) {
    body.presentations = [
      { name: 'Bolsa', unitId: bolsa.unitId, conversionFactor: bolsa.factor, salePrice: '0' },
    ];
  }
  const res = await api().post('/api/products').set('Cookie', cookie).send(body).expect(201);
  const presentation = (res.body.presentations as Array<{ id: string }>)[0];
  return { productId: res.body.id as string, presentationId: presentation?.id ?? null };
}

async function createSupplier(cookie: string, name: string): Promise<string> {
  const res = await api().post('/api/suppliers').set('Cookie', cookie).send({ name }).expect(201);
  return res.body.id as string;
}

interface DraftItem {
  productId: string;
  presentationId?: string;
  quantity: string;
  unitCost: string;
}

async function createDraft(
  cookie: string,
  supplierId: string,
  items: DraftItem[],
  extra: Record<string, unknown> = {},
): Promise<request.Response> {
  return api()
    .post('/api/purchases')
    .set('Cookie', cookie)
    .send({ supplierId, items, ...extra });
}

const balanceOf = (tenantId: string, productId: string) =>
  prisma.inventoryBalance.findUnique({
    where: { tenantId_productId: { tenantId, productId } },
  });

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

describe('Proveedores', () => {
  it('crea un proveedor y lo lista', async () => {
    const cookie = await login('buyerA');
    const id = await createSupplier(cookie, 'Proveedor Central');
    const res = await api().get(`/api/suppliers/${id}`).set('Cookie', cookie).expect(200);
    expect(res.body.name).toBe('Proveedor Central');
    expect(res.body.isActive).toBe(true);
  });

  it('nombre duplicado en el mismo tenant: 409 SUPPLIER_NAME_TAKEN', async () => {
    const cookie = await login('buyerA');
    await createSupplier(cookie, 'Proveedor Repetido');
    const res = await api()
      .post('/api/suppliers')
      .set('Cookie', cookie)
      .send({ name: 'Proveedor Repetido' })
      .expect(409);
    expect(res.body.code).toBe('SUPPLIER_NAME_TAKEN');
  });

  it('aislamiento entre tenants: B no ve ni edita el proveedor de A', async () => {
    const cookieA = await login('buyerA');
    const cookieB = await login('buyerB');
    const id = await createSupplier(cookieA, 'Solo de A prov');

    await api().get(`/api/suppliers/${id}`).set('Cookie', cookieB).expect(404);
    await api()
      .patch(`/api/suppliers/${id}`)
      .set('Cookie', cookieB)
      .send({ phone: '999' })
      .expect(404);

    // el mismo nombre SI puede existir en B (unicidad es por tenant)
    await createSupplier(cookieB, 'Solo de A prov');

    const listB = await api()
      .get('/api/suppliers?search=Solo%20de%20A%20prov')
      .set('Cookie', cookieB)
      .expect(200);
    expect(listB.body.total).toBe(1);
  });

  it('desactivar: no borra, marca isActive=false y sale del listado activo', async () => {
    const cookie = await login('buyerA');
    const id = await createSupplier(cookie, 'Proveedor a desactivar');
    await api().post(`/api/suppliers/${id}/deactivate`).set('Cookie', cookie).expect(201);

    const active = await api()
      .get('/api/suppliers?search=Proveedor%20a%20desactivar')
      .set('Cookie', cookie)
      .expect(200);
    expect(active.body.total).toBe(0);

    const all = await api()
      .get('/api/suppliers?status=all&search=Proveedor%20a%20desactivar')
      .set('Cookie', cookie)
      .expect(200);
    expect(all.body.total).toBe(1);
    expect(all.body.items[0].isActive).toBe(false);
  });
});

describe('Compra en borrador', () => {
  it('crea una compra en DRAFT y NO modifica el inventario', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S draft');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto draft');

    const res = await createDraft(cookie, supplierId, [
      { productId, quantity: '10', unitCost: '3' },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.subtotal).toBe('30');
    expect(res.body.total).toBe('30');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('0');
    const moves = await prisma.inventoryMovement.count({
      where: { tenantId: ids.tenantA, productId },
    });
    expect(moves).toBe(0);
  });

  it('edita un borrador: reemplaza items y recalcula totales', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S edit');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto edit');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '10', unitCost: '3' },
    ]);

    const res = await api()
      .patch(`/api/purchases/${draft.body.id}`)
      .set('Cookie', cookie)
      .send({ items: [{ productId, quantity: '5', unitCost: '4' }], tax: '1.5' })
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.subtotal).toBe('20');
    expect(res.body.total).toBe('21.5');
  });

  it('no se puede editar una compra COMPLETED: 409 PURCHASE_NOT_DRAFT', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S locked');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto locked');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '2', unitCost: '5' },
    ]);
    await api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookie).expect(201);

    const res = await api()
      .patch(`/api/purchases/${draft.body.id}`)
      .set('Cookie', cookie)
      .send({ tax: '9' })
      .expect(409);
    expect(res.body.code).toBe('PURCHASE_NOT_DRAFT');
  });
});

describe('Completar compra', () => {
  it('sin presentacion: incrementa la existencia y fija el costo (stock inicial cero)', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S base');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto base cost');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '100', unitCost: '7.5' },
    ]);

    const res = await api()
      .post(`/api/purchases/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .expect(201);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completedByName).toBe('buyerA');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('100');
    expect(balance?.averageCost.toString()).toBe('7.5');

    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: ids.tenantA, productId },
    });
    expect(movement.type).toBe('PURCHASE');
    expect(movement.referenceType).toBe('PURCHASE');
    expect(movement.referenceId).toBe(draft.body.id);
    expect(movement.baseQuantity.toString()).toBe('100');
  });

  it('con presentacion: convierte a unidad base y usa el costo por unidad base', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S cemento');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Cemento e2e', {
      unitId: ids.bolsaA,
      factor: '50',
    });

    // 20 bolsas de 50 lb a L 250 c/u  ->  1000 lb, L 5 / lb, subtotal 5000
    const draft = await createDraft(cookie, supplierId, [
      { productId, presentationId: presentationId!, quantity: '20', unitCost: '250' },
    ]);
    const res = await api()
      .post(`/api/purchases/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .expect(201);
    expect(res.body.subtotal).toBe('5000');
    expect(res.body.items[0].baseQuantity).toBe('1000');
    expect(res.body.items[0].unitBaseCost).toBe('5');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('1000');
    expect(balance?.averageCost.toString()).toBe('5');

    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: ids.tenantA, productId, type: 'PURCHASE' },
    });
    expect(movement.quantity.toString()).toBe('20'); // capturada en bolsas
    expect(movement.baseQuantity.toString()).toBe('1000'); // aplicada en libras
    expect(movement.unitId).toBe(ids.bolsaA);
  });

  it('promedio ponderado: una segunda compra promedia por cantidades en unidad base', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S promedio');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto promedio');

    const d1 = await createDraft(cookie, supplierId, [
      { productId, quantity: '100', unitCost: '10' },
    ]);
    await api().post(`/api/purchases/${d1.body.id}/complete`).set('Cookie', cookie).expect(201);

    const d2 = await createDraft(cookie, supplierId, [
      { productId, quantity: '50', unitCost: '12' },
    ]);
    await api().post(`/api/purchases/${d2.body.id}/complete`).set('Cookie', cookie).expect(201);

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('150');
    // (100*10 + 50*12) / 150 = 10.666667
    expect(balance?.averageCost.toString()).toBe('10.666667');
  });

  it('multiples items y calculo del total en backend', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S multi');
    const p1 = await createProduct(cookie, ids.libraA, 'Multi 1');
    const p2 = await createProduct(cookie, ids.libraA, 'Multi 2');

    // el backend NO acepta subtotal/total del cliente: enviarlos es 400
    const rejected = await createDraft(
      cookie,
      supplierId,
      [{ productId: p1.productId, quantity: '3', unitCost: '2.5' }],
      { subtotal: '99999', total: '88888' },
    );
    expect(rejected.status).toBe(400);

    const draft = await createDraft(
      cookie,
      supplierId,
      [
        { productId: p1.productId, quantity: '3', unitCost: '2.5' }, // 7.5
        { productId: p2.productId, quantity: '1.5', unitCost: '4' }, // 6
      ],
      { discount: '1', tax: '0.5' },
    );
    expect(draft.status).toBe(201);
    // subtotal y total los calcula el backend
    expect(draft.body.subtotal).toBe('13.5');
    expect(draft.body.total).toBe('13'); // 13.5 - 1 + 0.5

    await api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookie).expect(201);
    expect((await balanceOf(ids.tenantA, p1.productId))?.quantity.toString()).toBe('3');
    expect((await balanceOf(ids.tenantA, p2.productId))?.quantity.toString()).toBe('1.5');
  });

  it('usuario sin purchases.complete: 403 PERMISSION_DENIED', async () => {
    const buyer = await login('buyerA');
    const supplierId = await createSupplier(buyer, 'S noperm');
    const { productId } = await createProduct(buyer, ids.libraA, 'Producto noperm');
    const draft = await createDraft(buyer, supplierId, [
      { productId, quantity: '1', unitCost: '1' },
    ]);

    const weak = await login('noCompleteA');
    const res = await api()
      .post(`/api/purchases/${draft.body.id}/complete`)
      .set('Cookie', weak)
      .expect(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('tenant incorrecto: B no ve ni completa la compra de A (404)', async () => {
    const cookieA = await login('buyerA');
    const cookieB = await login('buyerB');
    const supplierId = await createSupplier(cookieA, 'S cross');
    const { productId } = await createProduct(cookieA, ids.libraA, 'Producto cross');
    const draft = await createDraft(cookieA, supplierId, [
      { productId, quantity: '1', unitCost: '1' },
    ]);

    await api().get(`/api/purchases/${draft.body.id}`).set('Cookie', cookieB).expect(404);
    await api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookieB).expect(404);
  });

  it('doble finalizacion: la segunda peticion recibe 409 y el inventario se aplica una sola vez', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S doble');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto doble');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '40', unitCost: '2' },
    ]);

    const [r1, r2] = await Promise.all([
      api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookie),
      api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookie),
    ]);
    const statuses = [r1.status, r2.status].toSorted((x, y) => x - y);
    expect(statuses).toEqual([201, 409]);

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('40');
    const moves = await prisma.inventoryMovement.count({
      where: { tenantId: ids.tenantA, productId, type: 'PURCHASE' },
    });
    expect(moves).toBe(1);
  });

  it('rollback: si un item es invalido al completar, nada se aplica y la compra sigue DRAFT', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S rollback');
    const good = await createProduct(cookie, ids.libraA, 'Rollback bueno');
    const bad = await createProduct(cookie, ids.libraA, 'Rollback malo');
    const draft = await createDraft(cookie, supplierId, [
      { productId: good.productId, quantity: '10', unitCost: '1' },
      { productId: bad.productId, quantity: '5', unitCost: '1' },
    ]);

    // el segundo producto queda inactivo -> INVALID_PURCHASE_ITEM al completar
    await prisma.product.update({ where: { id: bad.productId }, data: { status: 'INACTIVE' } });

    const res = await api()
      .post(`/api/purchases/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .expect(422);
    expect(res.body.code).toBe('INVALID_PURCHASE_ITEM');

    expect((await balanceOf(ids.tenantA, good.productId))?.quantity.toString()).toBe('0');
    const moves = await prisma.inventoryMovement.count({
      where: { tenantId: ids.tenantA, productId: good.productId },
    });
    expect(moves).toBe(0);
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: draft.body.id } });
    expect(purchase.status).toBe('DRAFT');
  });

  it('proveedor inactivo: no se puede completar (422 SUPPLIER_INACTIVE)', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S se apaga');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto sup inactivo');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '1', unitCost: '1' },
    ]);
    await api().post(`/api/suppliers/${supplierId}/deactivate`).set('Cookie', cookie).expect(201);

    const res = await api()
      .post(`/api/purchases/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .expect(422);
    expect(res.body.code).toBe('SUPPLIER_INACTIVE');
  });
});

describe('Cancelar compra', () => {
  it('cancelacion valida: revierte la existencia y conserva la compra', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S cancel ok');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto cancel ok');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '30', unitCost: '4' },
    ]);
    await api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookie).expect(201);
    expect((await balanceOf(ids.tenantA, productId))?.quantity.toString()).toBe('30');

    const res = await api()
      .post(`/api/purchases/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'Producto llego danado' })
      .expect(201);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancellationReason).toBe('Producto llego danado');
    expect(res.body.cancelledByName).toBe('buyerA');

    expect((await balanceOf(ids.tenantA, productId))?.quantity.toString()).toBe('0');
    const reversal = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: ids.tenantA, productId, type: 'REVERSAL' },
    });
    expect(reversal.referenceType).toBe('PURCHASE');
    expect(reversal.referenceId).toBe(draft.body.id);
    expect(reversal.baseQuantity.toString()).toBe('-30');

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: ids.tenantA, action: 'PURCHASE_CANCELLED', entityId: draft.body.id },
    });
    expect(audit).not.toBeNull();
  });

  it('cancelacion sin motivo: 400 VALIDATION_ERROR', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S cancel sin motivo');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto cancel sin motivo');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '1', unitCost: '1' },
    ]);
    await api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookie).expect(201);

    const res = await api()
      .post(`/api/purchases/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({})
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('cancelacion duplicada: la segunda recibe 409 PURCHASE_NOT_COMPLETED', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S cancel doble');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto cancel doble');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '10', unitCost: '1' },
    ]);
    await api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookie).expect(201);
    await api()
      .post(`/api/purchases/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'primera' })
      .expect(201);

    const res = await api()
      .post(`/api/purchases/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'segunda' })
      .expect(409);
    expect(res.body.code).toBe('PURCHASE_NOT_COMPLETED');
  });

  it('no se puede cancelar una compra en DRAFT', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S cancel draft');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto cancel draft');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '1', unitCost: '1' },
    ]);
    const res = await api()
      .post(`/api/purchases/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'no aplica' })
      .expect(409);
    expect(res.body.code).toBe('PURCHASE_NOT_COMPLETED');
  });

  it('cancelacion que dejaria stock negativo: 422 PURCHASE_CANCELLATION_STOCK_CONFLICT', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S cancel neg');
    const { productId } = await createProduct(cookie, ids.libraA, 'Producto cancel neg');
    const draft = await createDraft(cookie, supplierId, [
      { productId, quantity: '100', unitCost: '2' },
    ]);
    await api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookie).expect(201);

    // se consume casi todo con una salida de inventario
    await api()
      .post('/api/inventory/adjustments')
      .set('Cookie', cookie)
      .send({ productId, direction: 'OUT', quantity: '90', reason: 'venta simulada' })
      .expect(201);

    const res = await api()
      .post(`/api/purchases/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'intento imposible' })
      .expect(422);
    expect(res.body.code).toBe('PURCHASE_CANCELLATION_STOCK_CONFLICT');

    // nada cambio: sigue COMPLETED y la existencia se mantiene en 10
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: draft.body.id } });
    expect(purchase.status).toBe('COMPLETED');
    expect((await balanceOf(ids.tenantA, productId))?.quantity.toString()).toBe('10');
  });
});

describe('Decimales', () => {
  it('cantidades y costos fraccionarios: aritmetica exacta de punta a punta', async () => {
    const cookie = await login('buyerA');
    const supplierId = await createSupplier(cookie, 'S decimales');
    const { productId, presentationId } = await createProduct(
      cookie,
      ids.libraA,
      'Producto decimales',
      { unitId: ids.bolsaA, factor: '2.5' },
    );
    // 1.5 bolsas de 2.5 lb a L 9.99  ->  base 3.75 lb ; unitBaseCost 3.996 ; subtotal 14.985
    const draft = await createDraft(cookie, supplierId, [
      { productId, presentationId: presentationId!, quantity: '1.5', unitCost: '9.99' },
    ]);
    const res = await api()
      .post(`/api/purchases/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .expect(201);
    expect(res.body.items[0].baseQuantity).toBe('3.75');
    expect(res.body.items[0].unitBaseCost).toBe('3.996');
    expect(res.body.subtotal).toBe('14.985');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('3.75');
    expect(balance?.averageCost.toString()).toBe('3.996');
  });
});
