/**
 * Seed — Fase 2: Fundacion SaaS e Identidad.
 *
 * Dos bloques:
 *
 *   seedCatalog()      Datos de plataforma validos en CUALQUIER entorno,
 *                      incluido produccion: catalogo de permisos y features.
 *
 *   seedDevelopment()  Solo fuera de produccion. Plan de prueba, Platform
 *                      Admin de desarrollo y un tenant demo con sus 5 roles
 *                      de sistema, replicando la secuencia transaccional de
 *                      creacion de tenant (RF-020 / docs/05 180-216).
 *
 * Todo con upsert => idempotente, re-ejecutable.
 *
 * Sin credenciales en codigo: el Platform Admin y el owner demo se crean sin
 * passwordHash (la autenticacion se implementa en una fase posterior).
 * Identidad de usuarios y tenant tomada de variables de entorno.
 *
 * Prisma 7 usa driver adapter (sin engine): se construye el PrismaClient con
 * PrismaPg a partir de DATABASE_URL, igual que apps/api/src/prisma/prisma.service.ts.
 */

import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { FEATURE_CATALOG, FEATURE_CODES } from '../apps/api/src/authz/feature-codes.js';
import { PERMISSION_CATALOG } from '../apps/api/src/authz/permissions.catalog.js';
import { PLAN_LIMIT_KEYS } from '../apps/api/src/authz/plan-limits.js';
import { SYSTEM_ROLE_TEMPLATE_LIST } from '../apps/api/src/authz/role-templates.js';
import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no esta definida');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEV_PLAN_CODE = 'DEV';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  }
  return value;
}

/** Catalogo global. Seguro en produccion. */
async function seedCatalog(): Promise<void> {
  for (const perm of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      create: { code: perm.code, module: perm.module, description: perm.description },
      update: { module: perm.module, description: perm.description },
    });
  }

  for (const feature of FEATURE_CATALOG) {
    await prisma.feature.upsert({
      where: { code: feature.code },
      create: { code: feature.code, name: feature.name, description: feature.description },
      update: { name: feature.name, description: feature.description },
    });
  }

  console.log(
    `  catalogo: ${PERMISSION_CATALOG.length} permisos, ${FEATURE_CATALOG.length} features`,
  );
}

/** Plan de desarrollo: todo habilitado, sin limites. */
async function seedDevPlan(): Promise<string> {
  const plan = await prisma.plan.upsert({
    where: { code: DEV_PLAN_CODE },
    create: {
      code: DEV_PLAN_CODE,
      name: 'Plan de desarrollo',
      description: 'Plan de prueba: todas las features, sin limites. No usar en produccion.',
      price: 0,
      currency: 'HNL',
      billingInterval: 'MONTHLY',
      gracePeriodDays: 7,
      isActive: true,
    },
    update: {},
  });

  const features = await prisma.feature.findMany({ where: { code: { in: [...FEATURE_CODES] } } });
  for (const feature of features) {
    await prisma.planFeature.upsert({
      where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
      create: { planId: plan.id, featureId: feature.id, enabled: true },
      update: { enabled: true },
    });
  }

  for (const key of PLAN_LIMIT_KEYS) {
    await prisma.planLimit.upsert({
      where: { planId_key: { planId: plan.id, key } },
      create: { planId: plan.id, key, value: null }, // null = sin limite
      update: { value: null },
    });
  }

  return plan.id;
}

/** Platform Admin de desarrollo. Sin credencial. */
async function seedPlatformAdmin(): Promise<void> {
  const email = requireEnv('PLATFORM_ADMIN_EMAIL');
  const name = process.env.PLATFORM_ADMIN_NAME ?? 'Platform Admin';

  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash: null, isPlatformAdmin: true, status: 'ACTIVE' },
    update: { name, isPlatformAdmin: true },
  });

  console.log(`  platform admin: ${email}`);
}

/**
 * Tenant demo + owner + 5 roles de sistema + suscripcion + primer periodo,
 * en UNA transaccion (docs/05 180-216: si falla un paso, no queda un tenant
 * incompleto). La auditoria de la creacion va en la misma transaccion
 * (docs/05 1782-1802).
 */
async function seedDevTenant(planId: string): Promise<void> {
  const tenantName = requireEnv('DEV_TENANT_NAME');
  const ownerEmail = requireEnv('DEV_TENANT_OWNER_EMAIL');
  const ownerName = process.env.DEV_TENANT_OWNER_NAME ?? 'Owner';

  const existing = await prisma.tenant.findFirst({ where: { name: tenantName } });
  if (existing) {
    console.log(`  tenant demo: ${tenantName} (ya existe, sin cambios)`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: tenantName, status: 'ACTIVE', baseCurrency: 'HNL' },
    });

    const owner = await tx.user.upsert({
      where: { email: ownerEmail },
      create: { email: ownerEmail, name: ownerName, passwordHash: null, status: 'ACTIVE' },
      update: {},
    });

    const permissions = await tx.permission.findMany();
    const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

    let ownerRoleId = '';
    for (const template of SYSTEM_ROLE_TEMPLATE_LIST) {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: template.name,
          description: template.description,
          isSystem: true,
        },
      });
      if (template.name === 'OWNER') {
        ownerRoleId = role.id;
      }

      await tx.rolePermission.createMany({
        data: template.permissions.map((code) => {
          const permissionId = permissionIdByCode.get(code);
          if (!permissionId) {
            throw new Error(`Permiso ${code} no esta en la tabla permissions`);
          }
          return { roleId: role.id, permissionId };
        }),
      });
    }

    await tx.tenantMembership.create({
      data: { tenantId: tenant.id, userId: owner.id, roleId: ownerRoleId, status: 'ACTIVE' },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId,
        status: 'ACTIVE',
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await tx.subscriptionPeriod.create({
      data: {
        subscriptionId: subscription.id,
        tenantId: tenant.id,
        planId,
        periodStart: now,
        periodEnd,
        status: 'PAID',
      },
    });

    const admin = await tx.user.findUnique({
      where: { email: requireEnv('PLATFORM_ADMIN_EMAIL') },
    });

    await tx.platformAuditLog.create({
      data: {
        actorUserId: admin?.id ?? null,
        tenantId: tenant.id,
        action: 'TENANT_CREATED',
        entityType: 'Tenant',
        entityId: tenant.id,
        metadata: { source: 'seed', plan: DEV_PLAN_CODE },
      },
    });

    console.log(
      `  tenant demo: ${tenantName} + owner ${ownerEmail} + ${SYSTEM_ROLE_TEMPLATE_LIST.length} roles + suscripcion ACTIVE`,
    );
  });
}

async function seedDevelopment(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.log('  NODE_ENV=production: se omite el seed de desarrollo');
    return;
  }
  await seedPlatformAdmin();
  const planId = await seedDevPlan();
  await seedDevTenant(planId);
}

async function main(): Promise<void> {
  console.log('Seed: fundacion SaaS e identidad');
  await seedCatalog();
  await seedDevelopment();
  console.log('Seed completado');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
