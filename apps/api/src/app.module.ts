import { fileURLToPath } from 'node:url';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

// .env vive en la raiz del monorepo. Tanto en src/ como en dist/ este archivo
// esta a tres niveles de la raiz (apps/api/src | apps/api/dist).
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));

/**
 * Modulo raiz.
 *
 * En esta fase solo infraestructura: configuracion, base de datos y healthcheck.
 * Los modulos de dominio (auth, tenants, users, products, inventory, purchases,
 * sales, credits, cash, reports, audit) se agregan en fases posteriores
 * (docs/07-ARQUITECTURA-TECNICA.md 3).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [rootEnv, '.env'],
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
