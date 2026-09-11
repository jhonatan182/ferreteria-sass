/**
 * E2E del modulo de clientes (Fase 7).
 * Requiere PostgreSQL accesible (`pnpm db:up`).
 *
 * Cubre: crear cliente, aislamiento entre tenants, nombre duplicado, cliente
 * general (existe/perezoso, unico, no se desactiva, no recibe limite de
 * credito), editar, desactivar/reactivar, usuario sin permiso.
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

const MARK = '__customere2e__';
const EMAIL_DOMAIN = 'customere2e.local';
const PASSWORD = 'Secret123!';
const email = (local: string): string => `${local}@${EMAIL_DOMAIN}`.toLowerCase();

const OWNER_PERMS = [
  'customers.read',
  'customers.create',
  'customers.update',
  'customers.deactivate',
  'credits.change_limit',
];
const READ_ONLY_PERMS = ['customers.read'];

interface Ids {
  tenantA: string;
  tenantB: string;
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

  async function makeTenant(suffix: string): Promise<string> {
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
    return tenant.id;
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

  const tenantA = await makeTenant('A');
  const tenantB = await makeTenant('B');
  await makeUser('ownerA', tenantA, OWNER_PERMS);
  await makeUser('readonlyA', tenantA, READ_ONLY_PERMS);
  await makeUser('ownerB', tenantB, OWNER_PERMS);

  return { tenantA, tenantB };
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
  await prisma.customer.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

async function createCustomer(cookie: string, name: string): Promise<string> {
  const res = await api().post('/api/customers').set('Cookie', cookie).send({ name }).expect(201);
  return res.body.id as string;
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

describe('Clientes', () => {
  it('crea un cliente y lo lista', async () => {
    const cookie = await login('ownerA');
    const id = await createCustomer(cookie, 'Cliente Uno');
    const res = await api().get(`/api/customers/${id}`).set('Cookie', cookie).expect(200);
    expect(res.body.name).toBe('Cliente Uno');
    expect(res.body.isActive).toBe(true);
    expect(res.body.isGeneralCustomer).toBe(false);
    expect(res.body.creditLimit).toBe('0');
  });

  it('nombre duplicado en el mismo tenant: 409 CUSTOMER_NAME_TAKEN', async () => {
    const cookie = await login('ownerA');
    await createCustomer(cookie, 'Cliente Repetido');
    const res = await api()
      .post('/api/customers')
      .set('Cookie', cookie)
      .send({ name: 'Cliente Repetido' })
      .expect(409);
    expect(res.body.code).toBe('CUSTOMER_NAME_TAKEN');
  });

  it('aislamiento entre tenants: B no ve ni edita el cliente de A', async () => {
    const cookieA = await login('ownerA');
    const cookieB = await login('ownerB');
    const id = await createCustomer(cookieA, 'Solo de A cliente');

    await api().get(`/api/customers/${id}`).set('Cookie', cookieB).expect(404);
    await api()
      .patch(`/api/customers/${id}`)
      .set('Cookie', cookieB)
      .send({ phone: '999' })
      .expect(404);

    // el mismo nombre SI puede existir en B (unicidad es por tenant)
    await createCustomer(cookieB, 'Solo de A cliente');

    const listB = await api()
      .get('/api/customers?search=Solo%20de%20A%20cliente')
      .set('Cookie', cookieB)
      .expect(200);
    expect(listB.body.total).toBe(1);
  });

  it('edita un cliente', async () => {
    const cookie = await login('ownerA');
    const id = await createCustomer(cookie, 'Cliente Editable');
    const res = await api()
      .patch(`/api/customers/${id}`)
      .set('Cookie', cookie)
      .send({ phone: '2233-4455', email: 'cliente@editable.hn' })
      .expect(200);
    expect(res.body.phone).toBe('2233-4455');
    expect(res.body.email).toBe('cliente@editable.hn');
  });

  it('desactivar: no borra, marca isActive=false y sale del listado activo', async () => {
    const cookie = await login('ownerA');
    const id = await createCustomer(cookie, 'Cliente a desactivar');
    await api().post(`/api/customers/${id}/deactivate`).set('Cookie', cookie).expect(201);

    const active = await api()
      .get('/api/customers?search=Cliente%20a%20desactivar')
      .set('Cookie', cookie)
      .expect(200);
    expect(active.body.total).toBe(0);

    const all = await api()
      .get('/api/customers?status=all&search=Cliente%20a%20desactivar')
      .set('Cookie', cookie)
      .expect(200);
    expect(all.body.total).toBe(1);
    expect(all.body.items[0].isActive).toBe(false);

    await api().post(`/api/customers/${id}/activate`).set('Cookie', cookie).expect(201);
    const reactivated = await api().get(`/api/customers/${id}`).set('Cookie', cookie).expect(200);
    expect(reactivated.body.isActive).toBe(true);
  });

  it('usuario sin customers.create: 403 PERMISSION_DENIED', async () => {
    const weak = await login('readonlyA');
    const res = await api()
      .post('/api/customers')
      .set('Cookie', weak)
      .send({ name: 'Nunca se crea' })
      .expect(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('cambia el limite de credito', async () => {
    const cookie = await login('ownerA');
    const id = await createCustomer(cookie, 'Cliente con credito');
    const res = await api()
      .post(`/api/customers/${id}/credit-limit`)
      .set('Cookie', cookie)
      .send({ creditLimit: '5000', reason: 'Cliente frecuente' })
      .expect(201);
    expect(res.body.creditLimit).toBe('5000');
  });
});

describe('Cliente general', () => {
  it('existe (o se crea de forma perezosa), es unico y no puede desactivarse ni recibir credito', async () => {
    const cookie = await login('ownerA');
    const first = await api().get('/api/customers/general').set('Cookie', cookie).expect(200);
    expect(first.body.isGeneralCustomer).toBe(true);

    const second = await api().get('/api/customers/general').set('Cookie', cookie).expect(200);
    expect(second.body.id).toBe(first.body.id);

    const generalCount = await prisma.customer.count({
      where: { tenantId: ids.tenantA, isGeneralCustomer: true },
    });
    expect(generalCount).toBe(1);

    const deactivateRes = await api()
      .post(`/api/customers/${first.body.id}/deactivate`)
      .set('Cookie', cookie)
      .expect(422);
    expect(deactivateRes.body.code).toBe('GENERAL_CUSTOMER_PROTECTED');

    const creditRes = await api()
      .post(`/api/customers/${first.body.id}/credit-limit`)
      .set('Cookie', cookie)
      .send({ creditLimit: '1000' })
      .expect(422);
    expect(creditRes.body.code).toBe('GENERAL_CUSTOMER_PROTECTED');
  });

  it('cada tenant tiene su propio cliente general', async () => {
    const cookieA = await login('ownerA');
    const cookieB = await login('ownerB');
    const a = await api().get('/api/customers/general').set('Cookie', cookieA).expect(200);
    const b = await api().get('/api/customers/general').set('Cookie', cookieB).expect(200);
    expect(a.body.id).not.toBe(b.body.id);
  });
});
