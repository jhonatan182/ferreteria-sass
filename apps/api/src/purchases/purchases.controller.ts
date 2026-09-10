import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { CurrentContext, RequirePermissions } from '../auth/auth.decorators.js';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto.js';
import { CreatePurchaseDto } from './dto/create-purchase.dto.js';
import { ListPurchasesQuery } from './dto/list-purchases.query.js';
import { UpdatePurchaseDto } from './dto/update-purchase.dto.js';
import { PurchasesService } from './purchases.service.js';
import type { PurchaseDetailView, PurchaseListItemView } from './purchases.views.js';

/**
 * API de compras (docs/07 446-471, docs/03 509-515). Prefijo global `/api`.
 * Los cuatro guards globales de `AuthModule` actuan; cada handler declara su
 * permiso `purchases.*`. El `tenantId` y el actor salen del contexto
 * autenticado, nunca de params/body (AGENTS.md 4-5).
 *
 * Los cambios de estado con efectos usan acciones de dominio, no `PATCH status`
 * (AGENTS.md 17, docs/05 60): `POST :id/complete`, `POST :id/cancel`.
 */
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  @RequirePermissions('purchases.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Query() query: ListPurchasesQuery,
  ): Promise<Paginated<PurchaseListItemView>> {
    return this.purchases.list(ctx, query);
  }

  @Get(':id')
  @RequirePermissions('purchases.read')
  get(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PurchaseDetailView> {
    return this.purchases.get(ctx, id);
  }

  @Post()
  @RequirePermissions('purchases.create')
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreatePurchaseDto,
  ): Promise<PurchaseDetailView> {
    return this.purchases.create(ctx, dto);
  }

  @Patch(':id')
  @RequirePermissions('purchases.update')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePurchaseDto,
  ): Promise<PurchaseDetailView> {
    return this.purchases.update(ctx, id, dto);
  }

  @Post(':id/complete')
  @RequirePermissions('purchases.complete')
  complete(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PurchaseDetailView> {
    return this.purchases.complete(ctx, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('purchases.cancel')
  cancel(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelPurchaseDto,
  ): Promise<PurchaseDetailView> {
    return this.purchases.cancel(ctx, id, dto);
  }
}
