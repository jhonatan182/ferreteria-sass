import { Module } from '@nestjs/common';

import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

/**
 * Modulo de clientes (Fase 7, docs/04 865-891). CRUD tenant-owned sin borrado
 * fisico + cliente general + cambio de limite de credito. `AuditModule` y
 * `PrismaModule` son globales.
 *
 * Exporta `CustomersService` para que `SalesModule` valide el cliente de una
 * venta. Nucleo, no funcionalidad comercial: sin `Feature` ni limite de plan
 * (docs/04 seccion 48).
 */
@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
