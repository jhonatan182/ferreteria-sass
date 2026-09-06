/**
 * E2E de autenticacion, contexto de tenant y autorizacion (fase 3).
 * Requiere PostgreSQL accesible (`pnpm db:up`).
 *
 * Cubre los casos exigidos: login valido, contrasena incorrecta, usuario
 * inactivo, usuario sin membresia, seleccion de tenant ajeno, endpoint
 * protegido sin sesion / sin permiso / con permiso, tenant suspendido y
 * aislamiento entre dos tenants.
 */
/* oxlint-disable no-await-in-loop -- el fixture inserta en serie por dependencias de FK */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PERMISSION_CATALOG } from '../src/authz/permissions.catalog.js';
import { SYSTEM_ROLE_TEMPLATES } from '../src/authz/role-templates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const MARK = '__authe2e__';
const EMAIL_DOMAIN = 'authe2e.local';
const PASSWORD = 'Secret123!';
// Emails en minuscula: el backend normaliza el correo a lowercase al autenticar.
const email = (local: string): string => `${local}@${EMAIL_DOMAIN}`.toLowerCase();

interface Ctx {
  app: INestApplication;
  prisma: PrismaService;
  ids: {
    planId: string;
    tenantA: string;
    tenantB: string;
    tenantS: string;
    users: Record<string, string>;
  };
}

let ctx: Ctx;

async function seedFixture(prisma: PrismaService): Promise<Ctx['ids']> {
  // Catalogo de permisos (por si la BD esta limpia).
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

  const plan = await prisma.plan.create({
    data: { code: `${MARK}plan`, name: `${MARK}plan`, price: 0 },
  });

  const passwordHash = await bcrypt.hash(PASSWORD, 4);

  async function makeTenant(
    suffix: string,
    status: 'ACTIVE' | 'SUSPENDED',
  ): Promise<{ tenantId: string; ownerRoleId: string; cashierRoleId: string }> {
    const tenant = await prisma.tenant.create({
      data: { name: `${MARK}${suffix}`, status, baseCurrency: 'HNL' },
    });
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 86_400_000);
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: end,
      },
    });

    const roleIds: Record<string, string> = {};
    for (const name of ['OWNER', 'CASHIER'] as const) {
      const role = await prisma.role.create({
        data: { tenantId: tenant.id, name, isSystem: true },
      });
      roleIds[name] = role.id;
      await prisma.rolePermission.createMany({
        data: SYSTEM_ROLE_TEMPLATES[name].permissions.map((code) => ({
          roleId: role.id,
          permissionId: permIdByCode.get(code)!,
        })),
      });
    }
    return { tenantId: tenant.id, ownerRoleId: roleIds.OWNER!, cashierRoleId: roleIds.CASHIER! };
  }

  const a = await makeTenant('A', 'ACTIVE');
  const b = await makeTenant('B', 'ACTIVE');
  const s = await makeTenant('S', 'SUSPENDED');

  const users: Record<string, string> = {};
  async function makeUser(
    local: string,
    status: 'ACTIVE' | 'INACTIVE',
    memberships: Array<{ tenantId: string; roleId: string }>,
  ): Promise<void> {
    const user = await prisma.user.create({
      data: { name: local, email: email(local), passwordHash, status },
    });
    users[local] = user.id;
    for (const m of memberships) {
      await prisma.tenantMembership.create({
        data: { tenantId: m.tenantId, userId: user.id, roleId: m.roleId, status: 'ACTIVE' },
      });
    }
  }

  await makeUser('ownerA', 'ACTIVE', [{ tenantId: a.tenantId, roleId: a.ownerRoleId }]);
  await makeUser('cashierA', 'ACTIVE', [{ tenantId: a.tenantId, roleId: a.cashierRoleId }]);
  await makeUser('ownerB', 'ACTIVE', [{ tenantId: b.tenantId, roleId: b.ownerRoleId }]);
  await makeUser('multi', 'ACTIVE', [
    { tenantId: a.tenantId, roleId: a.ownerRoleId },
    { tenantId: b.tenantId, roleId: b.ownerRoleId },
  ]);
  await makeUser('inactive', 'INACTIVE', [{ tenantId: a.tenantId, roleId: a.ownerRoleId }]);
  await makeUser('nomember', 'ACTIVE', []);
  await makeUser('ownerS', 'ACTIVE', [{ tenantId: s.tenantId, roleId: s.ownerRoleId }]);

  return {
    planId: plan.id,
    tenantA: a.tenantId,
    tenantB: b.tenantId,
    tenantS: s.tenantId,
    users,
  };
}

async function cleanup(prisma: PrismaService): Promise<void> {
  const tenants = await prisma.tenant.findMany({ where: { name: { startsWith: MARK } } });
  const tenantIds = tenants.map((t) => t.id);
  const users = await prisma.user.findMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  const userIds = users.map((u) => u.id);
  const roles = await prisma.role.findMany({ where: { tenantId: { in: tenantIds } } });
  const roleIds = roles.map((r) => r.id);

  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
  await prisma.role.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.subscriptionPeriod.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.planLimit.deleteMany({ where: { plan: { code: { startsWith: MARK } } } });
  await prisma.planFeature.deleteMany({ where: { plan: { code: { startsWith: MARK } } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: MARK } } });
}

function cookieFrom(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c: string) => c.split(';')[0]).join('; ');
}

const api = (): request.Agent => request(ctx.app.getHttpServer());

async function login(local: string): Promise<string> {
  const res = await api()
    .post('/api/auth/login')
    .send({ email: email(local), password: PASSWORD })
    .expect(200);
  return cookieFrom(res);
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  const prisma = app.get(PrismaService);
  await cleanup(prisma);
  const ids = await seedFixture(prisma);
  ctx = { app, prisma, ids };
}, 60_000);

afterAll(async () => {
  if (ctx?.prisma) {
    await cleanup(ctx.prisma);
  }
  await ctx?.app?.close();
});

describe('Login', () => {
  it('login valido devuelve 200, cookie httpOnly y contexto auto-seleccionado', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: email('ownerA'), password: PASSWORD })
      .expect(200);

    const setCookie = res.headers['set-cookie'][0] as string;
    expect(setCookie).toMatch(/ferreteria_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(res.body.activeTenantId).toBe(ctx.ids.tenantA);
    expect(res.body.requiresTenantSelection).toBe(false);
    expect(res.body).not.toHaveProperty('token');
  });

  it('contrasena incorrecta -> 401 INVALID_CREDENTIALS', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: email('ownerA'), password: 'mala' })
      .expect(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('usuario inactivo -> 403 ACCOUNT_INACTIVE', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: email('inactive'), password: PASSWORD })
      .expect(403);
    expect(res.body.code).toBe('ACCOUNT_INACTIVE');
  });

  it('usuario sin membresia -> 403 NO_TENANT_ACCESS', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: email('nomember'), password: PASSWORD })
      .expect(403);
    expect(res.body.code).toBe('NO_TENANT_ACCESS');
  });

  it('usuario multi-tenant -> 200 sin auto-seleccion, requiere elegir', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: email('multi'), password: PASSWORD })
      .expect(200);
    expect(res.body.activeTenantId).toBeNull();
    expect(res.body.requiresTenantSelection).toBe(true);
    expect(res.body.memberships).toHaveLength(2);
  });
});

describe('Seleccion de tenant', () => {
  it('no permite seleccionar un tenant sin membresia -> 403 TENANT_ACCESS_DENIED', async () => {
    const cookie = await login('ownerA');
    const res = await api()
      .post('/api/auth/select-tenant')
      .set('Cookie', cookie)
      .send({ tenantId: ctx.ids.tenantB })
      .expect(403);
    expect(res.body.code).toBe('TENANT_ACCESS_DENIED');
  });

  it('usuario multi-tenant puede cambiar de tenant explicitamente', async () => {
    const cookie = await login('multi');

    // Sin tenant elegido, un endpoint tenant-scoped exige seleccion.
    await api().get('/api/roles').set('Cookie', cookie).expect(409);

    const a = await api()
      .post('/api/auth/select-tenant')
      .set('Cookie', cookie)
      .send({ tenantId: ctx.ids.tenantA })
      .expect(200);
    expect(a.body.context.tenantId).toBe(ctx.ids.tenantA);

    const b = await api()
      .post('/api/auth/select-tenant')
      .set('Cookie', cookie)
      .send({ tenantId: ctx.ids.tenantB })
      .expect(200);
    expect(b.body.context.tenantId).toBe(ctx.ids.tenantB);
  });
});

describe('Proteccion de endpoints', () => {
  it('sin sesion -> 401', async () => {
    const res = await api().get('/api/auth/context').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('sin el permiso requerido -> 403 PERMISSION_DENIED', async () => {
    const cookie = await login('cashierA');
    const res = await api().get('/api/roles').set('Cookie', cookie).expect(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
    expect(res.body.details.missing).toContain('roles.read');
  });

  it('con el permiso requerido -> 200', async () => {
    const cookie = await login('ownerA');
    const res = await api().get('/api/roles').set('Cookie', cookie).expect(200);
    // El fixture crea 2 roles por tenant (OWNER, CASHIER).
    expect(res.body).toHaveLength(2);
    expect(res.body.map((r: { name: string }) => r.name).toSorted()).toEqual(['CASHIER', 'OWNER']);
  });

  it('logout invalida la sesion (RF-004)', async () => {
    const cookie = await login('ownerA');
    await api().get('/api/auth/context').set('Cookie', cookie).expect(200);
    await api().post('/api/auth/logout').set('Cookie', cookie).expect(200);
    const res = await api().get('/api/auth/context').set('Cookie', cookie).expect(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
  });
});

describe('Tenant y suscripcion', () => {
  it('tenant suspendido -> 403 TENANT_SUSPENDED', async () => {
    const cookie = await login('ownerS');
    const res = await api().get('/api/auth/context').set('Cookie', cookie).expect(403);
    expect(res.body.code).toBe('TENANT_SUSPENDED');
  });

  it('/auth/me tolera el tenant suspendido y expone el motivo', async () => {
    const cookie = await login('ownerS');
    const res = await api().get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(res.body.context).toBeNull();
    expect(res.body.contextIssue).toBe('TENANT_SUSPENDED');
  });
});

describe('Aislamiento entre tenants', () => {
  it('cada owner solo ve los roles de su propio tenant', async () => {
    const cookieA = await login('ownerA');
    const cookieB = await login('ownerB');

    const rolesA = await api().get('/api/roles').set('Cookie', cookieA).expect(200);
    const rolesB = await api().get('/api/roles').set('Cookie', cookieB).expect(200);

    // Mismos nombres (plantillas de sistema) pero ids disjuntos.
    const idsA = new Set(rolesA.body.map((r: { id: string }) => r.id));
    const idsB = new Set(rolesB.body.map((r: { id: string }) => r.id));
    for (const id of idsA) {
      expect(idsB.has(id)).toBe(false);
    }

    // El contexto de A jamas reporta el tenant de B.
    const ctxA = await api().get('/api/auth/context').set('Cookie', cookieA).expect(200);
    expect(ctxA.body.context.tenantId).toBe(ctx.ids.tenantA);
  });
});
