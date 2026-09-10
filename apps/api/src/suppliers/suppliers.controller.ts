import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { CurrentContext, RequirePermissions } from '../auth/auth.decorators.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { ListSuppliersQuery } from './dto/list-suppliers.query.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { SuppliersService } from './suppliers.service.js';
import type { SupplierView } from './suppliers.views.js';

/**
 * API de proveedores (docs/07 446-471, docs/03 544-549). Prefijo global `/api`.
 * Los cuatro guards globales de `AuthModule` ya actuan; cada handler declara su
 * permiso `suppliers.*` (RF-010 / RP-033). El `tenantId` sale del contexto
 * autenticado, nunca de params/body (AGENTS.md 5).
 */
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Query() query: ListSuppliersQuery,
  ): Promise<Paginated<SupplierView>> {
    return this.suppliers.list(ctx, query);
  }

  @Get(':id')
  @RequirePermissions('suppliers.read')
  get(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<SupplierView> {
    return this.suppliers.get(ctx, id);
  }

  @Post()
  @RequirePermissions('suppliers.create')
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateSupplierDto,
  ): Promise<SupplierView> {
    return this.suppliers.create(ctx, dto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers.update')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierView> {
    return this.suppliers.update(ctx, id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermissions('suppliers.deactivate')
  deactivate(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<SupplierView> {
    return this.suppliers.setActive(ctx, id, false);
  }

  @Post(':id/activate')
  @RequirePermissions('suppliers.deactivate')
  activate(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<SupplierView> {
    return this.suppliers.setActive(ctx, id, true);
  }
}
