import { Module } from '@nestjs/common';

import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

/**
 * Modulo de inventario (Fase 5, docs/04 616-693, decisiones docs/04 seccion 46).
 *
 * `InventoryBalance` / `InventoryMovement` / `InventoryAdjustment`: consulta de
 * existencia, kardex, ajustes manuales, cambio manual de costo. SIN compras ni
 * ventas.
 *
 * `AuditModule` y `PrismaModule` son globales. Exporta `InventoryService`:
 *   - `ProductsModule` lo usa para crear el balance 0 al alta de un producto;
 *   - las futuras Compras y Ventas reutilizaran sus primitivos `*WithinTx`.
 *
 * Nucleo, no funcionalidad comercial: sin `Feature` ni limite de plan
 * (docs/04 seccion 45.8 / 46).
 */
@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
