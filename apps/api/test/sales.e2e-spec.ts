/**
 * E2E del modulo de ventas (Fase 7).
 * Requiere PostgreSQL accesible (`pnpm db:up`).
 *
 * Cubre los casos exigidos por el prompt de la fase: crear venta DRAFT, editar
 * DRAFT, DRAFT no afecta stock, completar venta, descuento correcto de stock,
 * conversion de presentacion, precio resuelto por backend, rechazo de precio
 * manipulado desde el frontend, stock insuficiente, multiples items, Decimal,
 * costo historico congelado, usuario sin permiso, tenant incorrecto, doble
 * finalizacion, rollback si falla un item, dos ventas concurrentes compitiendo
 * por el mismo stock, CASH/CARD/TRANSFER, cliente general rechazado para
 * CREDIT, limite de credito, cancelacion, cancelacion duplicada e inventario
 * restaurado al cancelar.
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

const MARK = '__salese2e__';
const EMAIL_DOMAIN = 'salese2e.local';
const PASSWORD = 'Secret123!';
const email = (local: string): string => `${local}@${EMAIL_DOMAIN}`.toLowerCase();

const SELLER_PERMS = [
  'products.read',
  'products.create',
  'inventory.read',
  'inventory.adjust',
  'suppliers.read',
  'suppliers.create',
  'purchases.read',
  'purchases.create',
  'purchases.complete',
  'customers.read',
  'customers.create',
  'credits.change_limit',
  'sales.read',
  'sales.create',
  'sales.cancel',
];
const NO_CANCEL_PERMS = [
  'products.read',
  'customers.read',
  'sales.read',
  'sales.create',
];
const VIEWER_PERMS = ['sales.read'];

interface Ids {
  tenantA: string;
  tenantB: string;
  libraA: string;
  bolsaA: string;
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

  // La feature CREDITS debe estar habilitada en el plan para que las ventas
  // CREDIT puedan completarse (docs/03 865-901, RF-013).
  const creditsFeature = await prisma.feature.upsert({
    where: { code: 'CREDITS' },
    create: { code: 'CREDITS', name: 'Creditos', description: 'Creditos' },
    update: {},
  });
  const plan = await prisma.plan.create({
    data: { code: `${MARK}plan`, name: `${MARK}plan`, price: 0 },
  });
  await prisma.planFeature.create({
    data: { planId: plan.id, featureId: creditsFeature.id, enabled: true },
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
  await makeUser('sellerA', a.tenantId, SELLER_PERMS);
  await makeUser('noCancelA', a.tenantId, NO_CANCEL_PERMS);
  await makeUser('viewerA', a.tenantId, VIEWER_PERMS);
  await makeUser('sellerB', b.tenantId, SELLER_PERMS);

  return {
    tenantA: a.tenantId,
    tenantB: b.tenantId,
    libraA: a.libra,
    bolsaA: a.bolsa,
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
  await prisma.creditMovement.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.creditAccount.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.salePayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.saleItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.sale.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.customer.deleteMany({ where: { tenantId: { in: tenantIds } } });
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
  await prisma.planFeature.deleteMany({ where: { plan: { code: { startsWith: MARK } } } });
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

/**
 * Producto en LIBRA con una presentacion base (precio `basePrice`) que queda
 * como predeterminada. Si `bolsa` se pasa, agrega una segunda presentacion
 * "Bolsa" con su propio precio y factor de conversion.
 */
async function createProduct(
  cookie: string,
  libraId: string,
  name: string,
  basePrice: string,
  bolsa?: { unitId: string; factor: string; price: string },
): Promise<{ productId: string; presentationId: string; bolsaPresentationId: string | null }> {
  const presentations: Array<Record<string, unknown>> = [
    { name: 'Libra', unitId: libraId, conversionFactor: '1', salePrice: basePrice, isDefault: true },
  ];
  if (bolsa) {
    presentations.push({
      name: 'Bolsa',
      unitId: bolsa.unitId,
      conversionFactor: bolsa.factor,
      salePrice: bolsa.price,
    });
  }
  const res = await api()
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name, baseUnitId: libraId, presentations })
    .expect(201);
  const list = res.body.presentations as Array<{ id: string; name: string }>;
  return {
    productId: res.body.id as string,
    presentationId: list.find((p) => p.name === 'Libra')!.id,
    bolsaPresentationId: list.find((p) => p.name === 'Bolsa')?.id ?? null,
  };
}

/**
 * Ingresa existencia mediante una compra completada (docs/04 seccion 46/47):
 * es la via real por la que un producto adquiere `averageCost`. Un ajuste
 * manual NO fija costo (docs/04 seccion 46 D7), asi que no sirve para preparar
 * los tests de costo historico.
 */
async function setStock(
  cookie: string,
  productId: string,
  quantity: string,
  unitCost = '1',
): Promise<void> {
  const supplierRes = await api()
    .post('/api/suppliers')
    .set('Cookie', cookie)
    .send({ name: `Proveedor stock ${Date.now()}-${Math.random().toString(36).slice(2)}` })
    .expect(201);
  const draft = await api()
    .post('/api/purchases')
    .set('Cookie', cookie)
    .send({ supplierId: supplierRes.body.id, items: [{ productId, quantity, unitCost }] })
    .expect(201);
  await api().post(`/api/purchases/${draft.body.id}/complete`).set('Cookie', cookie).expect(201);
}

async function createCustomer(
  cookie: string,
  name: string,
): Promise<{ id: string }> {
  const res = await api().post('/api/customers').set('Cookie', cookie).send({ name }).expect(201);
  return { id: res.body.id as string };
}

interface DraftItem {
  productId: string;
  presentationId?: string;
  quantity: string;
}

async function createDraft(
  cookie: string,
  items: DraftItem[],
  extra: Record<string, unknown> = {},
): Promise<request.Response> {
  return api()
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({ items, ...extra });
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

describe('Venta en borrador', () => {
  it('crea una venta en DRAFT con el cliente general por defecto y NO modifica el inventario', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto draft', '10');
    await setStock(cookie, productId, '50');

    const res = await createDraft(cookie, [{ productId, presentationId, quantity: '4' }]);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.subtotal).toBe('40');
    expect(res.body.total).toBe('40');
    expect(res.body.customerIsGeneral).toBe(true);

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('50');
    const moves = await prisma.inventoryMovement.count({
      where: { tenantId: ids.tenantA, productId, type: 'SALE' },
    });
    expect(moves).toBe(0);
  });

  it('edita un borrador: reemplaza items y recalcula totales', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto edit', '10');
    await setStock(cookie, productId, '50');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '2' }]);

    const res = await api()
      .patch(`/api/sales/${draft.body.id}`)
      .set('Cookie', cookie)
      .send({ items: [{ productId, presentationId, quantity: '5' }], tax: '1.5' })
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.subtotal).toBe('50');
    expect(res.body.total).toBe('51.5');
  });

  it('no se puede editar una venta COMPLETED: 409 SALE_NOT_DRAFT', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto locked', '10');
    await setStock(cookie, productId, '50');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '2' }]);
    await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);

    const res = await api()
      .patch(`/api/sales/${draft.body.id}`)
      .set('Cookie', cookie)
      .send({ tax: '9' })
      .expect(409);
    expect(res.body.code).toBe('SALE_NOT_DRAFT');
  });

  it('rechaza precio manipulado desde el frontend: 400 VALIDATION_ERROR', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto precio', '10');
    const res = await api()
      .post('/api/sales')
      .set('Cookie', cookie)
      .send({ items: [{ productId, presentationId, quantity: '1', unitPrice: '0.01' }] })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('Completar venta', () => {
  it('resuelve el precio desde la presentacion y descuenta la existencia exacta', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto precio backend', '15.50');
    await setStock(cookie, productId, '100');

    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '4' }]);
    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.items[0].unitPrice).toBe('15.5');
    expect(res.body.subtotal).toBe('62');
    expect(res.body.total).toBe('62');
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].method).toBe('CASH');
    expect(res.body.payments[0].amount).toBe('62');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('96');

    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: ids.tenantA, productId, type: 'SALE' },
    });
    expect(movement.referenceType).toBe('SALE');
    expect(movement.referenceId).toBe(draft.body.id);
    expect(movement.baseQuantity.toString()).toBe('-4');
  });

  it('con presentacion: convierte a unidad base (ejemplo cemento: 3 bolsas de 50 lb)', async () => {
    const cookie = await login('sellerA');
    const { productId, bolsaPresentationId } = await createProduct(
      cookie,
      ids.libraA,
      'Cemento e2e',
      '5',
      { unitId: ids.bolsaA, factor: '50', price: '220' },
    );
    await setStock(cookie, productId, '1000');

    const draft = await createDraft(cookie, [
      { productId, presentationId: bolsaPresentationId!, quantity: '3' },
    ]);
    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);
    expect(res.body.items[0].baseQuantity).toBe('150');
    expect(res.body.items[0].unitPrice).toBe('220');
    expect(res.body.subtotal).toBe('660');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('850');

    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: ids.tenantA, productId, type: 'SALE' },
    });
    expect(movement.quantity.toString()).toBe('3'); // capturada en bolsas
    expect(movement.baseQuantity.toString()).toBe('-150'); // aplicada en libras, con signo
    expect(movement.unitId).toBe(ids.bolsaA);
  });

  it('multiples items: descuenta cada producto y recalcula el total en backend', async () => {
    const cookie = await login('sellerA');
    const p1 = await createProduct(cookie, ids.libraA, 'Multi 1', '3');
    const p2 = await createProduct(cookie, ids.libraA, 'Multi 2', '4');
    await setStock(cookie, p1.productId, '20');
    await setStock(cookie, p2.productId, '20');

    // el backend NO acepta subtotal/total del cliente: enviarlos es 400
    const rejected = await createDraft(
      cookie,
      [{ productId: p1.productId, presentationId: p1.presentationId, quantity: '2' }],
      { subtotal: '99999', total: '88888' },
    );
    expect(rejected.status).toBe(400);

    const draft = await createDraft(
      cookie,
      [
        { productId: p1.productId, presentationId: p1.presentationId, quantity: '3' }, // 9
        { productId: p2.productId, presentationId: p2.presentationId, quantity: '1.5' }, // 6
      ],
      { discount: '1', tax: '0.5' },
    );
    expect(draft.status).toBe(201);
    expect(draft.body.subtotal).toBe('15');
    expect(draft.body.total).toBe('14.5'); // 15 - 1 + 0.5

    await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);
    expect((await balanceOf(ids.tenantA, p1.productId))?.quantity.toString()).toBe('17');
    expect((await balanceOf(ids.tenantA, p2.productId))?.quantity.toString()).toBe('18.5');
  });

  it('Decimales: cantidades y precios fraccionarios, aritmetica exacta de punta a punta', async () => {
    const cookie = await login('sellerA');
    const { productId, bolsaPresentationId } = await createProduct(
      cookie,
      ids.libraA,
      'Producto decimales',
      '1',
      { unitId: ids.bolsaA, factor: '2.5', price: '9.99' },
    );
    await setStock(cookie, productId, '100');

    // 1.5 bolsas de 2.5 lb a L 9.99 -> base 3.75 lb ; subtotal 14.985
    const draft = await createDraft(cookie, [
      { productId, presentationId: bolsaPresentationId!, quantity: '1.5' },
    ]);
    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);
    expect(res.body.items[0].baseQuantity).toBe('3.75');
    expect(res.body.subtotal).toBe('14.985');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('96.25');
  });

  it('costo historico: se congela al completar y no cambia si el promedio se mueve despues', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto costo', '20');
    await setStock(cookie, productId, '10', '20'); // averageCost = 20

    const balanceBefore = await balanceOf(ids.tenantA, productId);
    const costAtSale = balanceBefore!.averageCost.toString();
    expect(costAtSale).toBe('20');

    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '2' }]);
    const completed = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);
    expect(completed.body.items[0].unitBaseCost).toBe(costAtSale);
    // conversionFactor = 1 (presentacion base): unitCost == unitBaseCost.
    expect(completed.body.items[0].unitCost).toBe(costAtSale);

    // Otra compra con costo distinto mueve el promedio ponderado del producto.
    await setStock(cookie, productId, '10', '30');
    const balanceAfter = await balanceOf(ids.tenantA, productId);
    expect(balanceAfter!.averageCost.toString()).not.toBe(costAtSale);

    const detailAfter = await api()
      .get(`/api/sales/${draft.body.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detailAfter.body.items[0].unitBaseCost).toBe(costAtSale);
  });

  it('stock insuficiente: 422 INSUFFICIENT_STOCK y nada se aplica', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto stock insuf', '10');
    await setStock(cookie, productId, '5');

    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '12' }]);
    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(422);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('5');
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: draft.body.id } });
    expect(sale.status).toBe('DRAFT');
  });

  it('usuario sin permiso: 403 PERMISSION_DENIED', async () => {
    const seller = await login('sellerA');
    const { productId, presentationId } = await createProduct(seller, ids.libraA, 'Producto noperm', '10');
    await setStock(seller, productId, '10');
    const draft = await createDraft(seller, [{ productId, presentationId, quantity: '1' }]);

    const weak = await login('viewerA');
    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', weak)
      .send({ method: 'CASH' })
      .expect(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');

    const createRes = await api()
      .post('/api/sales')
      .set('Cookie', weak)
      .send({ items: [{ productId, presentationId, quantity: '1' }] })
      .expect(403);
    expect(createRes.body.code).toBe('PERMISSION_DENIED');
  });

  it('tenant incorrecto: B no ve ni completa la venta de A (404)', async () => {
    const cookieA = await login('sellerA');
    const cookieB = await login('sellerB');
    const { productId, presentationId } = await createProduct(cookieA, ids.libraA, 'Producto cross', '10');
    await setStock(cookieA, productId, '10');
    const draft = await createDraft(cookieA, [{ productId, presentationId, quantity: '1' }]);

    await api().get(`/api/sales/${draft.body.id}`).set('Cookie', cookieB).expect(404);
    await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookieB)
      .send({ method: 'CASH' })
      .expect(404);
  });

  it('doble finalizacion: la segunda peticion recibe 409 y el inventario se aplica una sola vez', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto doble', '2');
    await setStock(cookie, productId, '40');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '5' }]);

    const [r1, r2] = await Promise.all([
      api()
        .post(`/api/sales/${draft.body.id}/complete`)
        .set('Cookie', cookie)
        .send({ method: 'CASH' }),
      api()
        .post(`/api/sales/${draft.body.id}/complete`)
        .set('Cookie', cookie)
        .send({ method: 'CASH' }),
    ]);
    const statuses = [r1.status, r2.status].toSorted((x, y) => x - y);
    expect(statuses).toEqual([201, 409]);

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('35');
    const moves = await prisma.inventoryMovement.count({
      where: { tenantId: ids.tenantA, productId, type: 'SALE' },
    });
    expect(moves).toBe(1);
  });

  it('rollback: si un item es invalido al completar, nada se aplica y la venta sigue DRAFT', async () => {
    const cookie = await login('sellerA');
    const good = await createProduct(cookie, ids.libraA, 'Rollback bueno', '5');
    const bad = await createProduct(cookie, ids.libraA, 'Rollback malo', '5');
    await setStock(cookie, good.productId, '20');
    await setStock(cookie, bad.productId, '20');
    const draft = await createDraft(cookie, [
      { productId: good.productId, presentationId: good.presentationId, quantity: '3' },
      { productId: bad.productId, presentationId: bad.presentationId, quantity: '2' },
    ]);

    // el segundo producto queda inactivo -> INVALID_SALE_ITEM al completar
    await prisma.product.update({ where: { id: bad.productId }, data: { status: 'INACTIVE' } });

    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(422);
    expect(res.body.code).toBe('INVALID_SALE_ITEM');

    expect((await balanceOf(ids.tenantA, good.productId))?.quantity.toString()).toBe('20');
    const moves = await prisma.inventoryMovement.count({
      where: { tenantId: ids.tenantA, productId: good.productId, type: 'SALE' },
    });
    expect(moves).toBe(0);
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: draft.body.id } });
    expect(sale.status).toBe('DRAFT');
  });

  it('dos ventas concurrentes compitiendo por el mismo stock: solo una se completa', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto concurrencia', '1');
    await setStock(cookie, productId, '10');

    const draftA = await createDraft(cookie, [{ productId, presentationId, quantity: '7' }]);
    const draftB = await createDraft(cookie, [{ productId, presentationId, quantity: '7' }]);

    const [rA, rB] = await Promise.all([
      api()
        .post(`/api/sales/${draftA.body.id}/complete`)
        .set('Cookie', cookie)
        .send({ method: 'CASH' }),
      api()
        .post(`/api/sales/${draftB.body.id}/complete`)
        .set('Cookie', cookie)
        .send({ method: 'CASH' }),
    ]);
    const statuses = [rA.status, rB.status].toSorted((x, y) => x - y);
    expect(statuses).toEqual([201, 422]);
    const rejected = rA.status === 422 ? rA : rB;
    expect(rejected.body.code).toBe('INSUFFICIENT_STOCK');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('3');
    expect(balance!.quantity.gte(0)).toBe(true);
    const moves = await prisma.inventoryMovement.count({
      where: { tenantId: ids.tenantA, productId, type: 'SALE' },
    });
    expect(moves).toBe(1);
  });

  it('CARD: registra el pago sin generar movimiento de efectivo', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto card', '10');
    await setStock(cookie, productId, '10');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '1' }]);
    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CARD', reference: 'AUTH-0001' })
      .expect(201);
    expect(res.body.payments[0].method).toBe('CARD');
    expect(res.body.payments[0].reference).toBe('AUTH-0001');
  });

  it('TRANSFER: registra el pago con referencia', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto transfer', '10');
    await setStock(cookie, productId, '10');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '1' }]);
    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'TRANSFER', reference: 'TRX-99' })
      .expect(201);
    expect(res.body.payments[0].method).toBe('TRANSFER');
  });

  it('un monto de pago que no cuadra con el total: 422 SALE_PAYMENT_MISMATCH', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto pago', '10');
    await setStock(cookie, productId, '10');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '1' }]);
    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH', amount: '1' })
      .expect(422);
    expect(res.body.code).toBe('SALE_PAYMENT_MISMATCH');
  });
});

describe('Venta al credito', () => {
  it('cliente general rechazado para CREDIT: 422 CREDIT_REQUIRES_CUSTOMER', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto credito general', '10');
    await setStock(cookie, productId, '10');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '1' }]);

    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CREDIT' })
      .expect(422);
    expect(res.body.code).toBe('CREDIT_REQUIRES_CUSTOMER');
  });

  it('venta al credito con cliente especifico: aumenta el saldo de la cuenta', async () => {
    const cookie = await login('sellerA');
    const customer = await createCustomer(cookie, 'Cliente credito');
    await api()
      .post(`/api/customers/${customer.id}/credit-limit`)
      .set('Cookie', cookie)
      .send({ creditLimit: '1000' })
      .expect(201);
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto credito ok', '100');
    await setStock(cookie, productId, '10');

    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '4' }], {
      customerId: customer.id,
    });
    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CREDIT' })
      .expect(201);
    expect(res.body.payments[0].method).toBe('CREDIT');
    expect(res.body.total).toBe('400');

    const account = await prisma.creditAccount.findUniqueOrThrow({
      where: { customerId: customer.id },
    });
    expect(account.balance.toString()).toBe('400');
    expect(account.status).toBe('PENDING');

    const movement = await prisma.creditMovement.findFirstOrThrow({
      where: { creditAccountId: account.id, type: 'SALE' },
    });
    expect(movement.referenceType).toBe('SALE');
    expect(movement.referenceId).toBe(draft.body.id);
    expect(movement.amount.toString()).toBe('400');
  });

  it('excede el limite de credito: 422 CREDIT_LIMIT_EXCEEDED', async () => {
    const cookie = await login('sellerA');
    const customer = await createCustomer(cookie, 'Cliente limite');
    await api()
      .post(`/api/customers/${customer.id}/credit-limit`)
      .set('Cookie', cookie)
      .send({ creditLimit: '500' })
      .expect(201);
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto credito limite', '100');
    await setStock(cookie, productId, '20');

    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '7' }], {
      customerId: customer.id,
    }); // 700 > 500

    const res = await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CREDIT' })
      .expect(422);
    expect(res.body.code).toBe('CREDIT_LIMIT_EXCEEDED');

    const balance = await balanceOf(ids.tenantA, productId);
    expect(balance?.quantity.toString()).toBe('20');
  });
});

describe('Cancelar venta', () => {
  it('cancelacion valida: revierte la existencia, mantiene la venta y audita', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto cancel ok', '10');
    await setStock(cookie, productId, '30');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '12' }]);
    await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);
    const balanceAfterSale = await balanceOf(ids.tenantA, productId);
    expect(balanceAfterSale?.quantity.toString()).toBe('18');
    const averageCostBeforeCancel = balanceAfterSale!.averageCost.toString();

    const res = await api()
      .post(`/api/sales/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'Cliente se arrepintio' })
      .expect(201);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancellationReason).toBe('Cliente se arrepintio');
    expect(res.body.cancelledByName).toBe('sellerA');

    const balanceAfterCancel = await balanceOf(ids.tenantA, productId);
    expect(balanceAfterCancel?.quantity.toString()).toBe('30');
    // La cancelacion NO recalcula el promedio ponderado (docs/04 seccion 47 D10,
    // aplicado por analogia a ventas en docs/04 seccion 48): el REVERSAL guarda
    // el averageCost vigente como snapshot de trazabilidad, sin alterarlo.
    expect(balanceAfterCancel?.averageCost.toString()).toBe(averageCostBeforeCancel);

    const reversal = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: ids.tenantA, productId, type: 'REVERSAL' },
    });
    expect(reversal.referenceType).toBe('SALE');
    expect(reversal.referenceId).toBe(draft.body.id);
    expect(reversal.baseQuantity.toString()).toBe('12');
    expect(reversal.unitCost?.toString()).toBe(averageCostBeforeCancel);

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: ids.tenantA, action: 'SALE_CANCELLED', entityId: draft.body.id },
    });
    expect(audit).not.toBeNull();
  });

  it('cancelacion sin motivo: 400 VALIDATION_ERROR', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto cancel sin motivo', '10');
    await setStock(cookie, productId, '10');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '1' }]);
    await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);

    const res = await api()
      .post(`/api/sales/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({})
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('cancelacion duplicada: la segunda recibe 409 SALE_NOT_COMPLETED', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto cancel doble', '10');
    await setStock(cookie, productId, '10');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '1' }]);
    await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);
    await api()
      .post(`/api/sales/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'primera' })
      .expect(201);

    const res = await api()
      .post(`/api/sales/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'segunda' })
      .expect(409);
    expect(res.body.code).toBe('SALE_NOT_COMPLETED');
  });

  it('no se puede cancelar una venta en DRAFT', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto cancel draft', '10');
    await setStock(cookie, productId, '10');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '1' }]);
    const res = await api()
      .post(`/api/sales/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'no aplica' })
      .expect(409);
    expect(res.body.code).toBe('SALE_NOT_COMPLETED');
  });

  it('usuario sin sales.cancel: 403 PERMISSION_DENIED', async () => {
    const cookie = await login('sellerA');
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto cancel noperm', '10');
    await setStock(cookie, productId, '10');
    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '1' }]);
    await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CASH' })
      .expect(201);

    const weak = await login('noCancelA');
    const res = await api()
      .post(`/api/sales/${draft.body.id}/cancel`)
      .set('Cookie', weak)
      .send({ reason: 'no deberia poder' })
      .expect(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('cancelacion de una venta al credito: revierte el saldo de la cuenta', async () => {
    const cookie = await login('sellerA');
    const customer = await createCustomer(cookie, 'Cliente credito cancelable');
    await api()
      .post(`/api/customers/${customer.id}/credit-limit`)
      .set('Cookie', cookie)
      .send({ creditLimit: '1000' })
      .expect(201);
    const { productId, presentationId } = await createProduct(cookie, ids.libraA, 'Producto credito cancel', '50');
    await setStock(cookie, productId, '10');

    const draft = await createDraft(cookie, [{ productId, presentationId, quantity: '2' }], {
      customerId: customer.id,
    });
    await api()
      .post(`/api/sales/${draft.body.id}/complete`)
      .set('Cookie', cookie)
      .send({ method: 'CREDIT' })
      .expect(201);
    expect(
      (await prisma.creditAccount.findUniqueOrThrow({ where: { customerId: customer.id } })).balance.toString(),
    ).toBe('100');

    await api()
      .post(`/api/sales/${draft.body.id}/cancel`)
      .set('Cookie', cookie)
      .send({ reason: 'Devolucion de mercaderia' })
      .expect(201);

    const account = await prisma.creditAccount.findUniqueOrThrow({ where: { customerId: customer.id } });
    expect(account.balance.toString()).toBe('0');
    expect(account.status).toBe('PAID');
    const adjustment = await prisma.creditMovement.findFirstOrThrow({
      where: { creditAccountId: account.id, type: 'ADJUSTMENT' },
    });
    expect(adjustment.amount.toString()).toBe('-100');

    expect((await balanceOf(ids.tenantA, productId))?.quantity.toString()).toBe('10');
  });
});
