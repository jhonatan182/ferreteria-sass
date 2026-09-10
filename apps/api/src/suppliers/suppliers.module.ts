import { Module } from '@nestjs/common';

import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

/**
 * Modulo de proveedores (Fase 6, docs/04 767-785). CRUD tenant-owned sin
 * borrado fisico. `AuditModule` y `PrismaModule` son globales.
 *
 * Exporta `SuppliersService` para que `PurchasesModule` valide el proveedor de
 * una compra.
 */
@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
