import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { CurrentContext, CurrentTenant, RequirePermissions } from '../auth/auth.decorators.js';
import type { TenantContext } from '../auth/auth.types.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQuery } from './dto/list-products.query.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';
import type { ProductDetailView, ProductListItemView } from './products.views.js';

/**
 * API de productos (docs/07 446-471). Prefijo global `/api`. Sin guards de
 * clase: los cuatro guards globales de `AuthModule` ya actuan; cada handler
 * declara su permiso (`@RequirePermissions`, RF-010 / RP-033). El `tenantId`
 * sale siempre del contexto autenticado, nunca de params/body (AGENTS.md 5).
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions('products.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Query() query: ListProductsQuery,
  ): Promise<Paginated<ProductListItemView>> {
    return this.products.list(ctx, query);
  }

  @Get(':id')
  @RequirePermissions('products.read')
  get(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ProductDetailView> {
    return this.products.get(ctx, id);
  }

  @Post()
  @RequirePermissions('products.create')
  create(
    @CurrentContext() ctx: RequestContext,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDetailView> {
    return this.products.create(ctx, tenant, dto);
  }

  @Patch(':id')
  @RequirePermissions('products.update')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDetailView> {
    return this.products.update(ctx, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions('products.activate')
  activate(
    @CurrentContext() ctx: RequestContext,
    @CurrentTenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ProductDetailView> {
    return this.products.setStatus(ctx, tenant, id, 'ACTIVE');
  }

  @Post(':id/deactivate')
  @RequirePermissions('products.deactivate')
  deactivate(
    @CurrentContext() ctx: RequestContext,
    @CurrentTenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ProductDetailView> {
    return this.products.setStatus(ctx, tenant, id, 'INACTIVE');
  }
}
