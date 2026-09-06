import { fileURLToPath } from 'node:url';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductsModule } from './products/products.module.js';
import { RolesModule } from './roles/roles.module.js';

// .env vive en la raiz del monorepo. Tanto en src/ como en dist/ este archivo
// esta a tres niveles de la raiz (apps/api/src | apps/api/dist).
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));

/**
 * Modulo raiz.
 *
 * Infraestructura (configuracion, base de datos, healthcheck) + fase 3:
 * autenticacion, contexto de tenant y autorizacion base (`AuthModule`,
 * `RolesModule`) + fase 4: catalogo de productos (`ProductsModule`,
 * `AuditModule`). Los modulos de dominio restantes (tenants, users, inventory,
 * purchases, sales, credits, cash, reports) llegan en fases posteriores
 * (docs/07-ARQUITECTURA-TECNICA.md 3).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [rootEnv, '.env'],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    ProductsModule,
    RolesModule,
  ],
})
export class AppModule {}
