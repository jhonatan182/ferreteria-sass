import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { CurrentContext, CurrentTenant, RequirePermissions } from '../auth/auth.decorators.js';
import type { TenantContext } from '../auth/auth.types.js';
import { CancelSaleDto } from './dto/cancel-sale.dto.js';
import { CompleteSaleDto } from './dto/complete-sale.dto.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { ListSalesQuery } from './dto/list-sales.query.js';
import { UpdateSaleDto } from './dto/update-sale.dto.js';
import { SalesService } from './sales.service.js';
import type { SaleDetailView, SaleListItemView } from './sales.views.js';

/**
 * API de ventas (docs/07 446-471, docs/03 519-527). Prefijo global `/api`.
 * Los cuatro guards globales de `AuthModule` actuan; cada handler declara su
 * permiso `sales.*`. Completar una venta usa `sales.create` (docs/05 900-910;
 * el catalogo no define `sales.complete`). El `tenantId` y el actor salen del
 * contexto autenticado, nunca de params/body (AGENTS.md 4-5).
 *
 * Los cambios de estado con efectos son acciones de dominio, no `PATCH status`
 * (AGENTS.md 17, docs/05 60): `POST :id/complete`, `POST :id/cancel`.
 */
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @RequirePermissions('sales.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Query() query: ListSalesQuery,
  ): Promise<Paginated<SaleListItemView>> {
    return this.sales.list(ctx, query);
  }

  @Get(':id')
  @RequirePermissions('sales.read')
  get(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<SaleDetailView> {
    return this.sales.get(ctx, id);
  }

  @Post()
  @RequirePermissions('sales.create')
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateSaleDto,
  ): Promise<SaleDetailView> {
    return this.sales.create(ctx, dto);
  }

  @Patch(':id')
  @RequirePermissions('sales.create')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSaleDto,
  ): Promise<SaleDetailView> {
    return this.sales.update(ctx, id, dto);
  }

  @Post(':id/complete')
  @RequirePermissions('sales.create')
  complete(
    @CurrentContext() ctx: RequestContext,
    @CurrentTenant() tenantCtx: TenantContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CompleteSaleDto,
  ): Promise<SaleDetailView> {
    return this.sales.complete(ctx, tenantCtx, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales.cancel')
  cancel(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelSaleDto,
  ): Promise<SaleDetailView> {
    return this.sales.cancel(ctx, id, dto);
  }
}
