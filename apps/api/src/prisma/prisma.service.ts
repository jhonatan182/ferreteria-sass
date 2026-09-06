import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Acceso unico a la base de datos.
 *
 * Prisma 7 usa un driver adapter (sin motor Rust); la conexion se construye
 * aqui a partir de DATABASE_URL.
 *
 * Las operaciones de dominio que produzcan multiples efectos deben usar
 * `this.$transaction(...)` (AGENTS.md 8, 9, 21; docs/07 15-17).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL no esta definida');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexion a PostgreSQL establecida');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
