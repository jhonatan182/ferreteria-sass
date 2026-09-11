import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';

/**
 * Modulo de ventas (Fase 7, docs/04 896-996, docs/05 830-1010).
 *
 * Importa:
 *   - `InventoryModule` -> `InventoryService`:
 *       complete -> `decreaseWithinTx` (salida SALE, con proteccion de stock)
 *       cancel   -> `increaseWithinTx` (compensacion REVERSAL, sin tocar el promedio)
 *   - `CustomersModule` -> `CustomersService` (valida y resuelve el cliente general)
 *   - `AuthModule` -> `FeatureService` (una venta CREDIT exige la feature CREDITS)
 *
 * No se reimplementa nada de stock, costo ni concurrencia (docs/07 300-345).
 * `AuditModule` y `PrismaModule` son globales. Nucleo, no funcionalidad
 * comercial: sin `Feature` propia ni limite de plan (docs/04 seccion 48).
 */
@Module({
  imports: [InventoryModule, CustomersModule, AuthModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
