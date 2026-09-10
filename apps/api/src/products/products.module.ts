import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { BrandsController, CategoriesController, UnitsController } from './catalogs.controller.js';
import { CatalogsService } from './catalogs.service.js';
import { PresentationsController } from './presentations.controller.js';
import { PresentationsService } from './presentations.service.js';
import { ProductCodeService } from './product-code.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

/**
 * Modulo de catalogo comercial: Product, ProductPresentation, Category, Brand,
 * Unit (Fase 4, docs/04 seccion 45). Sin existencias, compras ni ventas.
 *
 * Importa `AuthModule` por `LimitService` (limite MAX_PRODUCTS, docs/05 53) e
 * `InventoryModule` por `InventoryService` (crear el balance 0 al alta de un
 * producto, docs/05 278-284). `AuditModule` y `PrismaModule` son globales.
 */
@Module({
  imports: [AuthModule, InventoryModule],
  controllers: [
    ProductsController,
    PresentationsController,
    CategoriesController,
    BrandsController,
    UnitsController,
  ],
  providers: [ProductsService, PresentationsService, CatalogsService, ProductCodeService],
})
export class ProductsModule {}
