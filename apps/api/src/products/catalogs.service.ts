import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@ferreteria/types';

import { AUDIT_ACTIONS } from '../audit/audit-actions.js';
import { AuditService } from '../audit/audit.service.js';
import { ConflictException, ERROR_CODES, NotFoundException } from '../common/errors.js';
import { isUniqueViolation } from '../common/prisma-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateBrandDto,
  CreateCategoryDto,
  CreateUnitDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateUnitDto,
} from './dto/catalog.dto.js';
import type { CatalogItemView, UnitView } from './products.views.js';

type NamedKind = 'category' | 'brand';
type CatalogStatus = 'ACTIVE' | 'INACTIVE';

/**
 * CRUD de los catalogos tenant-owned Category, Brand y Unit
 * (docs/04 512-571, docs/05 220-232).
 *
 * Toda query lleva `tenantId` del contexto (AGENTS.md 5). Sin borrado fisico:
 * activate / deactivate (RN-010). No se desactiva un item referenciado por
 * productos activos (CATALOG_IN_USE).
 */
@Injectable()
export class CatalogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Category / Brand -----------------------------------------------------

  async listNamed(ctx: RequestContext, kind: NamedKind, includeInactive: boolean): Promise<CatalogItemView[]> {
    const where = {
      tenantId: ctx.tenantId,
      ...(includeInactive ? {} : { status: 'ACTIVE' as const }),
    };
    const rows =
      kind === 'category'
        ? await this.prisma.category.findMany({ where, orderBy: { name: 'asc' } })
        : await this.prisma.brand.findMany({ where, orderBy: { name: 'asc' } });
    return rows.map(toCatalogItemView);
  }

  async createNamed(
    ctx: RequestContext,
    kind: NamedKind,
    dto: CreateCategoryDto | CreateBrandDto,
  ): Promise<CatalogItemView> {
    const name = dto.name.trim();
    return this.prisma.$transaction(async (tx) => {
      const created = await this.createNamedRow(tx, ctx.tenantId, kind, name, dto.description ?? null);
      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.CATALOG_ITEM_CREATED,
        entityType: entityType(kind),
        entityId: created.id,
        metadata: { name },
      });
      return toCatalogItemView(created);
    }).catch((error: unknown) => {
      throw translateUnique(error, kind);
    });
  }

  async updateNamed(
    ctx: RequestContext,
    kind: NamedKind,
    id: string,
    dto: UpdateCategoryDto | UpdateBrandDto,
  ): Promise<CatalogItemView> {
    await this.getNamedOrThrow(ctx, kind, id);
    const data: { name?: string; description?: string | null } = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    return this.prisma.$transaction(async (tx) => {
      const updated =
        kind === 'category'
          ? await tx.category.update({ where: { id }, data })
          : await tx.brand.update({ where: { id }, data });
      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.CATALOG_ITEM_UPDATED,
        entityType: entityType(kind),
        entityId: id,
        metadata: { changes: data },
      });
      return toCatalogItemView(updated);
    }).catch((error: unknown) => {
      throw translateUnique(error, kind);
    });
  }

  async setNamedStatus(
    ctx: RequestContext,
    kind: NamedKind,
    id: string,
    status: CatalogStatus,
  ): Promise<CatalogItemView> {
    await this.getNamedOrThrow(ctx, kind, id);
    if (status === 'INACTIVE') {
      const inUse = await this.prisma.product.count({
        where: {
          tenantId: ctx.tenantId,
          status: 'ACTIVE',
          ...(kind === 'category' ? { categoryId: id } : { brandId: id }),
        },
      });
      if (inUse > 0) {
        throw new ConflictException(
          ERROR_CODES.CATALOG_IN_USE,
          `No se puede desactivar: ${inUse} producto(s) activo(s) lo usan.`,
          { inUse },
        );
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const updated =
        kind === 'category'
          ? await tx.category.update({ where: { id }, data: { status } })
          : await tx.brand.update({ where: { id }, data: { status } });
      await this.audit.record(tx, ctx, {
        action:
          status === 'ACTIVE'
            ? AUDIT_ACTIONS.CATALOG_ITEM_ACTIVATED
            : AUDIT_ACTIONS.CATALOG_ITEM_DEACTIVATED,
        entityType: entityType(kind),
        entityId: id,
      });
      return toCatalogItemView(updated);
    });
  }

  // --- Unit ---------------------------------------------------------------

  async listUnits(ctx: RequestContext, includeInactive: boolean): Promise<UnitView[]> {
    const rows = await this.prisma.unit.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(includeInactive ? {} : { status: 'ACTIVE' }),
      },
      orderBy: { code: 'asc' },
    });
    return rows.map(toUnitView);
  }

  async createUnit(ctx: RequestContext, dto: CreateUnitDto): Promise<UnitView> {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.unit.create({
        data: { tenantId: ctx.tenantId, code, name, symbol: dto.symbol ?? null },
      });
      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.CATALOG_ITEM_CREATED,
        entityType: 'Unit',
        entityId: created.id,
        metadata: { code, name },
      });
      return toUnitView(created);
    }).catch((error: unknown) => {
      throw translateUnique(error, 'unit');
    });
  }

  async updateUnit(ctx: RequestContext, id: string, dto: UpdateUnitDto): Promise<UnitView> {
    await this.getUnitOrThrow(ctx, id);
    const data: { name?: string; symbol?: string | null } = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.symbol !== undefined) {
      data.symbol = dto.symbol;
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({ where: { id }, data });
      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.CATALOG_ITEM_UPDATED,
        entityType: 'Unit',
        entityId: id,
        metadata: { changes: data },
      });
      return toUnitView(updated);
    });
  }

  async setUnitStatus(ctx: RequestContext, id: string, status: CatalogStatus): Promise<UnitView> {
    await this.getUnitOrThrow(ctx, id);
    if (status === 'INACTIVE') {
      const [asBase, asPresentation] = await Promise.all([
        this.prisma.product.count({
          where: { tenantId: ctx.tenantId, status: 'ACTIVE', baseUnitId: id },
        }),
        this.prisma.productPresentation.count({
          where: { tenantId: ctx.tenantId, status: 'ACTIVE', unitId: id },
        }),
      ]);
      const inUse = asBase + asPresentation;
      if (inUse > 0) {
        throw new ConflictException(
          ERROR_CODES.CATALOG_IN_USE,
          `No se puede desactivar la unidad: la usan ${asBase} producto(s) y ${asPresentation} presentacion(es) activas.`,
          { asBase, asPresentation },
        );
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({ where: { id }, data: { status } });
      await this.audit.record(tx, ctx, {
        action:
          status === 'ACTIVE'
            ? AUDIT_ACTIONS.CATALOG_ITEM_ACTIVATED
            : AUDIT_ACTIONS.CATALOG_ITEM_DEACTIVATED,
        entityType: 'Unit',
        entityId: id,
      });
      return toUnitView(updated);
    });
  }

  // --- helpers privados --------------------------------------------------

  private async createNamedRow(
    tx: Prisma.TransactionClient,
    tenantId: string,
    kind: NamedKind,
    name: string,
    description: string | null,
  ) {
    return kind === 'category'
      ? tx.category.create({ data: { tenantId, name, description } })
      : tx.brand.create({ data: { tenantId, name, description } });
  }

  private async getNamedOrThrow(ctx: RequestContext, kind: NamedKind, id: string) {
    const row =
      kind === 'category'
        ? await this.prisma.category.findFirst({ where: { id, tenantId: ctx.tenantId } })
        : await this.prisma.brand.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!row) {
      throw new NotFoundException(`${entityType(kind)} no encontrada.`);
    }
    return row;
  }

  private async getUnitOrThrow(ctx: RequestContext, id: string) {
    const row = await this.prisma.unit.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!row) {
      throw new NotFoundException('Unidad no encontrada.');
    }
    return row;
  }
}

function entityType(kind: NamedKind): string {
  return kind === 'category' ? 'Category' : 'Brand';
}

function toCatalogItemView(row: {
  id: string;
  name: string;
  description: string | null;
  status: CatalogStatus;
}): CatalogItemView {
  return { id: row.id, name: row.name, description: row.description, status: row.status };
}

function toUnitView(row: {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  status: CatalogStatus;
}): UnitView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    status: row.status,
  };
}

/** P2002 (unique) -> codigo funcional CATALOG_NAME_TAKEN. */
function translateUnique(error: unknown, kind: NamedKind | 'unit'): unknown {
  if (isUniqueViolation(error)) {
    const label = kind === 'unit' ? 'El codigo de unidad' : 'El nombre';
    return new ConflictException(
      ERROR_CODES.CATALOG_NAME_TAKEN,
      `${label} ya existe en este tenant.`,
    );
  }
  return error;
}
