import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { CurrentContext, RequirePermissions } from '../auth/auth.decorators.js';
import { ChangeCostDto } from './dto/change-cost.dto.js';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import { KardexQuery } from './dto/kardex.query.js';
import { ListInventoryQuery } from './dto/list-inventory.query.js';
import { InventoryService } from './inventory.service.js';
import type {
  AdjustmentResultView,
  InventoryBalanceListItemView,
  KardexEntryView,
  ProductInventoryView,
} from './inventory.views.js';

/**
 * API de inventario (docs/07 446-471, docs/05 626-746).
 *
 * Sin guards de clase: los cuatro guards globales de `AuthModule` ya actuan;
 * cada handler declara su permiso. El `tenantId` sale del contexto autenticado,
 * nunca de params/body (AGENTS.md 5). No hay `PATCH`/`PUT`: la existencia solo
 * cambia por una operacion de dominio que genera un movimiento (RN-024).
 */
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermissions('inventory.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Query() query: ListInventoryQuery,
  ): Promise<Paginated<InventoryBalanceListItemView>> {
    return this.inventory.list(ctx, query);
  }

  @Get('products/:productId')
  @RequirePermissions('inventory.read')
  getProduct(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
  ): Promise<ProductInventoryView> {
    return this.inventory.getProductInventory(ctx, productId);
  }

  @Get('products/:productId/kardex')
  @RequirePermissions('inventory.kardex')
  kardex(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Query() query: KardexQuery,
  ): Promise<Paginated<KardexEntryView>> {
    return this.inventory.kardex(ctx, productId, query);
  }

  @Post('adjustments')
  @RequirePermissions('inventory.adjust')
  adjust(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateAdjustmentDto,
  ): Promise<AdjustmentResultView> {
    return this.inventory.adjustManual(ctx, dto);
  }

  @Post('products/:productId/cost')
  @RequirePermissions('products.change_cost')
  changeCost(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: ChangeCostDto,
  ): Promise<ProductInventoryView> {
    return this.inventory.changeCost(ctx, productId, dto);
  }
}
