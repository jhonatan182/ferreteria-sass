import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { RequestContext } from '@ferreteria/types';

import { CurrentContext, RequirePermissions } from '../auth/auth.decorators.js';
import { CatalogsService } from './catalogs.service.js';
import {
  CreateBrandDto,
  CreateCategoryDto,
  CreateUnitDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateUnitDto,
} from './dto/catalog.dto.js';
import type { CatalogItemView, UnitView } from './products.views.js';

const uuid = (): ParseUUIDPipe => new ParseUUIDPipe({ version: '4' });
const wantsInactive = (value: string | undefined): boolean => value === 'true' || value === 'all';

/**
 * Categorias (docs/04 512-527). Autorizacion (D3, docs/04 seccion 45): reusa
 * `products.read` / `products.create` / `products.update` — no hay `categories.*`.
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalogs: CatalogsService) {}

  @Get()
  @RequirePermissions('products.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Query('status') status?: string,
  ): Promise<CatalogItemView[]> {
    return this.catalogs.listNamed(ctx, 'category', wantsInactive(status));
  }

  @Post()
  @RequirePermissions('products.create')
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateCategoryDto,
  ): Promise<CatalogItemView> {
    return this.catalogs.createNamed(ctx, 'category', dto);
  }

  @Patch(':id')
  @RequirePermissions('products.update')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('id', uuid()) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CatalogItemView> {
    return this.catalogs.updateNamed(ctx, 'category', id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions('products.update')
  activate(
    @CurrentContext() ctx: RequestContext,
    @Param('id', uuid()) id: string,
  ): Promise<CatalogItemView> {
    return this.catalogs.setNamedStatus(ctx, 'category', id, 'ACTIVE');
  }

  @Post(':id/deactivate')
  @RequirePermissions('products.update')
  deactivate(
    @CurrentContext() ctx: RequestContext,
    @Param('id', uuid()) id: string,
  ): Promise<CatalogItemView> {
    return this.catalogs.setNamedStatus(ctx, 'category', id, 'INACTIVE');
  }
}

/** Marcas (docs/04 531-546). Misma autorizacion que las categorias (D3). */
@Controller('brands')
export class BrandsController {
  constructor(private readonly catalogs: CatalogsService) {}

  @Get()
  @RequirePermissions('products.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Query('status') status?: string,
  ): Promise<CatalogItemView[]> {
    return this.catalogs.listNamed(ctx, 'brand', wantsInactive(status));
  }

  @Post()
  @RequirePermissions('products.create')
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateBrandDto,
  ): Promise<CatalogItemView> {
    return this.catalogs.createNamed(ctx, 'brand', dto);
  }

  @Patch(':id')
  @RequirePermissions('products.update')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('id', uuid()) id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<CatalogItemView> {
    return this.catalogs.updateNamed(ctx, 'brand', id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions('products.update')
  activate(
    @CurrentContext() ctx: RequestContext,
    @Param('id', uuid()) id: string,
  ): Promise<CatalogItemView> {
    return this.catalogs.setNamedStatus(ctx, 'brand', id, 'ACTIVE');
  }

  @Post(':id/deactivate')
  @RequirePermissions('products.update')
  deactivate(
    @CurrentContext() ctx: RequestContext,
    @Param('id', uuid()) id: string,
  ): Promise<CatalogItemView> {
    return this.catalogs.setNamedStatus(ctx, 'brand', id, 'INACTIVE');
  }
}

/**
 * Unidades de medida (docs/04 552-571). TENANT-OWNED (D1). Escritura con
 * `products.manage_units` (docs/03 483); lectura con `products.read`.
 */
@Controller('units')
export class UnitsController {
  constructor(private readonly catalogs: CatalogsService) {}

  @Get()
  @RequirePermissions('products.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Query('status') status?: string,
  ): Promise<UnitView[]> {
    return this.catalogs.listUnits(ctx, wantsInactive(status));
  }

  @Post()
  @RequirePermissions('products.manage_units')
  create(@CurrentContext() ctx: RequestContext, @Body() dto: CreateUnitDto): Promise<UnitView> {
    return this.catalogs.createUnit(ctx, dto);
  }

  @Patch(':id')
  @RequirePermissions('products.manage_units')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('id', uuid()) id: string,
    @Body() dto: UpdateUnitDto,
  ): Promise<UnitView> {
    return this.catalogs.updateUnit(ctx, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions('products.manage_units')
  activate(@CurrentContext() ctx: RequestContext, @Param('id', uuid()) id: string): Promise<UnitView> {
    return this.catalogs.setUnitStatus(ctx, id, 'ACTIVE');
  }

  @Post(':id/deactivate')
  @RequirePermissions('products.manage_units')
  deactivate(
    @CurrentContext() ctx: RequestContext,
    @Param('id', uuid()) id: string,
  ): Promise<UnitView> {
    return this.catalogs.setUnitStatus(ctx, id, 'INACTIVE');
  }
}
