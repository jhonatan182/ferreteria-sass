import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module.js';
import { PurchasesController } from './purchases.controller.js';
import { PurchasesService } from './purchases.service.js';

/**
 * Modulo de compras (Fase 6, docs/04 789-841, docs/05 459-630).
 *
 * Importa `InventoryModule` para reutilizar `InventoryService`:
 *   - `complete` -> `increaseWithinTx` (entrada + promedio ponderado)
 *   - `cancel`   -> `decreaseWithinTx` (salida compensatoria, type REVERSAL)
 * No se reimplementa nada de stock ni de costo (docs/07 308-322, docs/04 seccion 46).
 *
 * `AuditModule` y `PrismaModule` son globales. Nucleo, no funcionalidad
 * comercial: sin `Feature` ni limite de plan.
 */
@Module({
  imports: [InventoryModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
