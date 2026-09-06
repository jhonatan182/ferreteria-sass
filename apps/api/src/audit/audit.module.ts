import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service.js';

/**
 * Auditoria operativa. `@Global` porque cualquier modulo de dominio la usa
 * dentro de sus transacciones (docs/05 1782-1810), igual que `PrismaModule`.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
