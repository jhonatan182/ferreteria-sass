import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { RequestContext } from '@ferreteria/types';

import { CurrentContext, RequirePermissions } from '../auth/auth.decorators.js';
import { ChangePriceDto } from './dto/change-price.dto.js';
import { CreatePresentationDto } from './dto/create-presentation.dto.js';
import { UpdatePresentationDto } from './dto/update-presentation.dto.js';
import { PresentationsService } from './presentations.service.js';
import type { PresentationView } from './products.views.js';

/**
 * API de presentaciones de un producto (docs/07 446-471, docs/05 322-394).
 *
 * `PATCH /:presentationId` NO cambia el precio: para eso esta
 * `POST /:presentationId/price`, con el permiso `products.change_price`
 * (docs/05 363-394, RP-026). El cambio de precio genera auditoria.
 */
@Controller('products/:productId/presentations')
export class PresentationsController {
  constructor(private readonly presentations: PresentationsService) {}

  @Get()
  @RequirePermissions('products.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
  ): Promise<PresentationView[]> {
    return this.presentations.list(ctx, productId);
  }

  @Post()
  @RequirePermissions('products.manage_presentations')
  create(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: CreatePresentationDto,
  ): Promise<PresentationView> {
    return this.presentations.create(ctx, productId, dto);
  }

  @Patch(':presentationId')
  @RequirePermissions('products.manage_presentations')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('presentationId', new ParseUUIDPipe({ version: '4' })) presentationId: string,
    @Body() dto: UpdatePresentationDto,
  ): Promise<PresentationView> {
    return this.presentations.update(ctx, productId, presentationId, dto);
  }

  @Post(':presentationId/price')
  @RequirePermissions('products.change_price')
  changePrice(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('presentationId', new ParseUUIDPipe({ version: '4' })) presentationId: string,
    @Body() dto: ChangePriceDto,
  ): Promise<PresentationView> {
    return this.presentations.changePrice(ctx, productId, presentationId, dto);
  }

  @Post(':presentationId/set-default')
  @RequirePermissions('products.manage_presentations')
  setDefault(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('presentationId', new ParseUUIDPipe({ version: '4' })) presentationId: string,
  ): Promise<PresentationView> {
    return this.presentations.setDefault(ctx, productId, presentationId);
  }

  @Post(':presentationId/activate')
  @RequirePermissions('products.manage_presentations')
  activate(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('presentationId', new ParseUUIDPipe({ version: '4' })) presentationId: string,
  ): Promise<PresentationView> {
    return this.presentations.setStatus(ctx, productId, presentationId, 'ACTIVE');
  }

  @Post(':presentationId/deactivate')
  @RequirePermissions('products.manage_presentations')
  deactivate(
    @CurrentContext() ctx: RequestContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('presentationId', new ParseUUIDPipe({ version: '4' })) presentationId: string,
  ): Promise<PresentationView> {
    return this.presentations.setStatus(ctx, productId, presentationId, 'INACTIVE');
  }
}
