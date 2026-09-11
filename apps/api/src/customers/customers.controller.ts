import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { CurrentContext, RequirePermissions } from '../auth/auth.decorators.js';
import { ChangeCreditLimitDto } from './dto/change-credit-limit.dto.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { ListCustomersQuery } from './dto/list-customers.query.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CustomersService } from './customers.service.js';
import type { CustomerView } from './customers.views.js';

/**
 * API de clientes (docs/07 446-471, docs/03 531-538). Prefijo global `/api`.
 * Los cuatro guards globales de `AuthModule` ya actuan; cada handler declara su
 * permiso `customers.*` (RF-010 / RP-033). El `tenantId` sale del contexto
 * autenticado, nunca de params/body (AGENTS.md 5).
 */
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customers.read')
  list(
    @CurrentContext() ctx: RequestContext,
    @Query() query: ListCustomersQuery,
  ): Promise<Paginated<CustomerView>> {
    return this.customers.list(ctx, query);
  }

  /** Cliente general del tenant (RF-091). Declarado antes de `:id`. */
  @Get('general')
  @RequirePermissions('customers.read')
  general(@CurrentContext() ctx: RequestContext): Promise<CustomerView> {
    return this.customers.getGeneral(ctx);
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  get(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<CustomerView> {
    return this.customers.get(ctx, id);
  }

  @Post()
  @RequirePermissions('customers.create')
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerView> {
    return this.customers.create(ctx, dto);
  }

  @Patch(':id')
  @RequirePermissions('customers.update')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerView> {
    return this.customers.update(ctx, id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermissions('customers.deactivate')
  deactivate(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<CustomerView> {
    return this.customers.setActive(ctx, id, false);
  }

  @Post(':id/activate')
  @RequirePermissions('customers.deactivate')
  activate(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<CustomerView> {
    return this.customers.setActive(ctx, id, true);
  }

  @Post(':id/credit-limit')
  @RequirePermissions('credits.change_limit')
  changeCreditLimit(
    @CurrentContext() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ChangeCreditLimitDto,
  ): Promise<CustomerView> {
    return this.customers.changeCreditLimit(ctx, id, dto);
  }
}
