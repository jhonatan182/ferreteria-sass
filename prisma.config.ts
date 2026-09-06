import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Configuracion del CLI de Prisma (migrate, generate, studio).
// La conexion de PrismaClient en runtime se configura por separado con un
// driver adapter en apps/api/src/prisma/prisma.service.ts.
//
// Se usa process.env directamente (no el helper `env()`) para que
// `prisma generate` funcione aunque DATABASE_URL no este definida
// (p. ej. en postinstall antes de crear .env).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
