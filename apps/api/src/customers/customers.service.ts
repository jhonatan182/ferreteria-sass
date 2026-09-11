import { Injectable } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { AUDIT_ACTIONS } from '../audit/audit-actions.js';
import { AuditService } from '../audit/audit.service.js';
import {
  BusinessRuleException,
  ConflictException,
  ERROR_CODES,
  NotFoundException,
} from '../common/errors.js';
import { isUniqueViolation } from '../common/prisma-error.js';
import { GENERAL_CUSTOMER_TEMPLATE } from '../catalog/customer-catalog.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangeCreditLimitDto } from './dto/change-credit-limit.dto.js';
import type { CreateCustomerDto } from './dto/create-customer.dto.js';
import type { ListCustomersQuery } from './dto/list-customers.query.js';
import type { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { toCustomerView, type CustomerView } from './customers.views.js';

const MONEY_SCALE = 4;

/**
 * Casos de uso de Customer (docs/04 865-891, docs/06 355-378, RN-043/RN-044).
 *
 * TENANT-OWNED: toda query lleva `tenantId` del contexto (AGENTS.md 5). Sin
 * borrado fisico (RN-010): `deactivate` marca `isActive = false` y conserva el
 * historial de ventas. Un nombre no se repite dentro del tenant.
 *
 * El cliente general (`isGeneralCustomer = true`) es una fila real, unica por
 * tenant (docs/04 seccion 48 D1). No se desactiva ni recibe limite de credito.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: RequestContext, query: ListCustomersQuery): Promise<Paginated<CustomerView>> {
    const where: Prisma.CustomerWhereInput = { tenantId: ctx.tenantId };
    if (query.status === 'active') {
      where.isActive = true;
    } else if (query.status === 'inactive') {
      where.isActive = false;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { identification: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        // El cliente general primero; luego alfabetico.
        orderBy: [{ isGeneralCustomer: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map(toCustomerView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(ctx: RequestContext, id: string): Promise<CustomerView> {
    return toCustomerView(await this.loadOrThrow(ctx, id));
  }

  /**
   * Cliente general del tenant (RF-091). Se crea de forma perezosa si el tenant
   * todavia no lo tiene (p. ej. tenants provisionados antes de la Fase 7). El
   * indice unico parcial garantiza que solo exista uno.
   */
  async getGeneral(ctx: RequestContext): Promise<CustomerView> {
    const existing = await this.prisma.customer.findFirst({
      where: { tenantId: ctx.tenantId, isGeneralCustomer: true },
    });
    if (existing) {
      return toCustomerView(existing);
    }
    try {
      const created = await this.prisma.customer.create({
        data: {
          tenantId: ctx.tenantId,
          name: GENERAL_CUSTOMER_TEMPLATE.name,
          isGeneralCustomer: true,
        },
      });
      return toCustomerView(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Otra peticion lo creo entre el SELECT y el INSERT: se relee.
        const now = await this.prisma.customer.findFirstOrThrow({
          where: { tenantId: ctx.tenantId, isGeneralCustomer: true },
        });
        return toCustomerView(now);
      }
      throw error;
    }
  }

  async create(ctx: RequestContext, dto: CreateCustomerDto): Promise<CustomerView> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.customer.create({
          data: {
            tenantId: ctx.tenantId,
            name: dto.name.trim(),
            identification: clean(dto.identification),
            phone: clean(dto.phone),
            email: clean(dto.email),
            address: clean(dto.address),
          },
        });
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.CUSTOMER_CREATED,
          entityType: 'Customer',
          entityId: row.id,
          metadata: { name: row.name },
        });
        return row;
      });
      return toCustomerView(created);
    } catch (error) {
      throw translateUnique(error);
    }
  }

  async update(ctx: RequestContext, id: string, dto: UpdateCustomerDto): Promise<CustomerView> {
    await this.loadOrThrow(ctx, id);

    const data: Prisma.CustomerUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.identification !== undefined) {
      data.identification = clean(dto.identification);
    }
    if (dto.phone !== undefined) {
      data.phone = clean(dto.phone);
    }
    if (dto.email !== undefined) {
      data.email = clean(dto.email);
    }
    if (dto.address !== undefined) {
      data.address = clean(dto.address);
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.customer.update({ where: { id }, data });
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
          entityType: 'Customer',
          entityId: id,
          metadata: { fields: Object.keys(dto) },
        });
        return row;
      });
      return toCustomerView(updated);
    } catch (error) {
      throw translateUnique(error);
    }
  }

  async setActive(ctx: RequestContext, id: string, isActive: boolean): Promise<CustomerView> {
    const customer = await this.loadOrThrow(ctx, id);
    if (customer.isGeneralCustomer) {
      throw new BusinessRuleException(
        ERROR_CODES.GENERAL_CUSTOMER_PROTECTED,
        'El cliente general no puede activarse ni desactivarse.',
      );
    }
    if (customer.isActive === isActive) {
      return toCustomerView(customer);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.customer.update({ where: { id }, data: { isActive } });
      await this.audit.record(tx, ctx, {
        action: isActive ? AUDIT_ACTIONS.CUSTOMER_ACTIVATED : AUDIT_ACTIONS.CUSTOMER_DEACTIVATED,
        entityType: 'Customer',
        entityId: id,
      });
      return row;
    });
    return toCustomerView(updated);
  }

  /** `POST /customers/:id/credit-limit` (permiso `credits.change_limit`, RN-051). */
  async changeCreditLimit(
    ctx: RequestContext,
    id: string,
    dto: ChangeCreditLimitDto,
  ): Promise<CustomerView> {
    const customer = await this.loadOrThrow(ctx, id);
    if (customer.isGeneralCustomer) {
      throw new BusinessRuleException(
        ERROR_CODES.GENERAL_CUSTOMER_PROTECTED,
        'El cliente general no puede tener limite de credito.',
      );
    }
    const previousLimit = customer.creditLimit.toFixed(MONEY_SCALE);
    const newLimit = new Prisma.Decimal(dto.creditLimit).toFixed(MONEY_SCALE);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.customer.update({ where: { id }, data: { creditLimit: newLimit } });
      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.CUSTOMER_CREDIT_LIMIT_CHANGED,
        entityType: 'Customer',
        entityId: id,
        metadata: { previousLimit, newLimit, reason: dto.reason?.trim() ?? null },
      });
      return row;
    });
    return toCustomerView(updated);
  }

  private async loadOrThrow(ctx: RequestContext, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }
    return customer;
  }
}

/** Normaliza un opcional: `''`/espacios/undefined/null -> `null`. */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** P2002 (unique) -> codigo funcional CUSTOMER_NAME_TAKEN. */
function translateUnique(error: unknown): unknown {
  if (isUniqueViolation(error)) {
    return new ConflictException(
      ERROR_CODES.CUSTOMER_NAME_TAKEN,
      'Ya existe un cliente con ese nombre en este tenant.',
    );
  }
  return error;
}
