import { Injectable } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { AUDIT_ACTIONS } from '../audit/audit-actions.js';
import { AuditService } from '../audit/audit.service.js';
import { ConflictException, ERROR_CODES, NotFoundException } from '../common/errors.js';
import { isUniqueViolation } from '../common/prisma-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSupplierDto } from './dto/create-supplier.dto.js';
import type { ListSuppliersQuery } from './dto/list-suppliers.query.js';
import type { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { toSupplierView, type SupplierView } from './suppliers.views.js';

/**
 * Casos de uso de Supplier (docs/04 767-785, docs/06 290-308, RN-002).
 *
 * TENANT-OWNED: toda query lleva `tenantId` del contexto (AGENTS.md 5). Sin
 * borrado fisico (RF-072, RN-010): `deactivate` marca `isActive = false` y
 * conserva el historial de compras. Un nombre no se repite dentro del tenant.
 */
@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: RequestContext, query: ListSuppliersQuery): Promise<Paginated<SupplierView>> {
    const where: Prisma.SupplierWhereInput = { tenantId: ctx.tenantId };
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
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map(toSupplierView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(ctx: RequestContext, id: string): Promise<SupplierView> {
    return toSupplierView(await this.loadOrThrow(ctx, id));
  }

  async create(ctx: RequestContext, dto: CreateSupplierDto): Promise<SupplierView> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.supplier.create({
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
          action: AUDIT_ACTIONS.SUPPLIER_CREATED,
          entityType: 'Supplier',
          entityId: row.id,
          metadata: { name: row.name },
        });
        return row;
      });
      return toSupplierView(created);
    } catch (error) {
      throw translateUnique(error);
    }
  }

  async update(ctx: RequestContext, id: string, dto: UpdateSupplierDto): Promise<SupplierView> {
    await this.loadOrThrow(ctx, id);

    const data: Prisma.SupplierUpdateInput = {};
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
        const row = await tx.supplier.update({ where: { id }, data });
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.SUPPLIER_UPDATED,
          entityType: 'Supplier',
          entityId: id,
          metadata: { fields: Object.keys(dto) },
        });
        return row;
      });
      return toSupplierView(updated);
    } catch (error) {
      throw translateUnique(error);
    }
  }

  async setActive(ctx: RequestContext, id: string, isActive: boolean): Promise<SupplierView> {
    const supplier = await this.loadOrThrow(ctx, id);
    if (supplier.isActive === isActive) {
      return toSupplierView(supplier);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.supplier.update({ where: { id }, data: { isActive } });
      await this.audit.record(tx, ctx, {
        action: isActive ? AUDIT_ACTIONS.SUPPLIER_ACTIVATED : AUDIT_ACTIONS.SUPPLIER_DEACTIVATED,
        entityType: 'Supplier',
        entityId: id,
      });
      return row;
    });
    return toSupplierView(updated);
  }

  private async loadOrThrow(ctx: RequestContext, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado.');
    }
    return supplier;
  }
}

/** Normaliza un opcional: `''`/espacios/undefined/null -> `null`. */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** P2002 (unique) -> codigo funcional SUPPLIER_NAME_TAKEN. */
function translateUnique(error: unknown): unknown {
  if (isUniqueViolation(error)) {
    return new ConflictException(
      ERROR_CODES.SUPPLIER_NAME_TAKEN,
      'Ya existe un proveedor con ese nombre en este tenant.',
    );
  }
  return error;
}
