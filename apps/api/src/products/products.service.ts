/* oxlint-disable no-await-in-loop -- creacion transaccional en serie: reintento de
   codigo bajo colision y alta de presentaciones dentro de una sola transaccion. */
import { Injectable } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { AUDIT_ACTIONS } from '../audit/audit-actions.js';
import { AuditService } from '../audit/audit.service.js';
import type { TenantContext } from '../auth/auth.types.js';
import { LimitService } from '../auth/limit.service.js';
import {
  BusinessRuleException,
  ConflictException,
  ERROR_CODES,
  NotFoundException,
} from '../common/errors.js';
import { isUniqueViolation, uniqueTarget } from '../common/prisma-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { CreatePresentationDto } from './dto/create-presentation.dto.js';
import type { ListProductsQuery } from './dto/list-products.query.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductCodeService } from './product-code.service.js';
import {
  decimalToString,
  type ProductDetailView,
  type ProductListItemView,
} from './products.views.js';

const MAX_CODE_RETRIES = 5;
const MAX_PRODUCTS_LIMIT_KEY = 'MAX_PRODUCTS';

/**
 * Casos de uso de Product (docs/04 475-508, docs/05 236-448, docs/06 171-241).
 *
 * El backend es la autoridad (AGENTS.md 4): revalida tenant, unicidad, unidad
 * base, presentaciones, limite del plan y estados. Toda operacion con multiples
 * efectos + auditoria va dentro de una transaccion (docs/05 1782-1810).
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly limits: LimitService,
    private readonly codes: ProductCodeService,
  ) {}

  async list(ctx: RequestContext, query: ListProductsQuery): Promise<Paginated<ProductListItemView>> {
    const where: Prisma.ProductWhereInput = { tenantId: ctx.tenantId };
    if (query.status !== 'all') {
      where.status = query.status;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.brandId) {
      where.brandId = query.brandId;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { internalCode: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
          baseUnit: { select: { code: true } },
          presentations: { where: { isDefault: true }, select: { salePrice: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        internalCode: row.internalCode,
        barcode: row.barcode,
        name: row.name,
        status: row.status,
        categoryName: row.category?.name ?? null,
        brandName: row.brand?.name ?? null,
        baseUnitCode: row.baseUnit.code,
        defaultPrice: decimalToString(row.presentations[0]?.salePrice ?? null),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(ctx: RequestContext, id: string): Promise<ProductDetailView> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        baseUnit: { select: { code: true } },
        presentations: {
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
          include: { unit: { select: { code: true } } },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return {
      id: product.id,
      internalCode: product.internalCode,
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      status: product.status,
      categoryId: product.categoryId,
      brandId: product.brandId,
      baseUnitId: product.baseUnitId,
      baseUnitCode: product.baseUnit.code,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      presentations: product.presentations.map((p) => ({
        id: p.id,
        name: p.name,
        unitId: p.unitId,
        unitCode: p.unit.code,
        conversionFactor: p.conversionFactor.toString(),
        salePrice: p.salePrice.toString(),
        isDefault: p.isDefault,
        status: p.status,
      })),
    };
  }

  async create(
    ctx: RequestContext,
    tenantCtx: TenantContext,
    dto: CreateProductDto,
  ): Promise<ProductDetailView> {
    const presentations = dto.presentations ?? [];
    validatePresentationInputs(presentations);

    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        const id = await this.prisma.$transaction(async (tx) => {
          await this.assertWithinProductLimit(tx, ctx.tenantId, tenantCtx);
          await assertCatalogRef(tx, ctx.tenantId, 'unit', dto.baseUnitId, 'La unidad base');
          if (dto.categoryId) {
            await assertCatalogRef(tx, ctx.tenantId, 'category', dto.categoryId, 'La categoria');
          }
          if (dto.brandId) {
            await assertCatalogRef(tx, ctx.tenantId, 'brand', dto.brandId, 'La marca');
          }
          for (const p of presentations) {
            await assertCatalogRef(tx, ctx.tenantId, 'unit', p.unitId, 'La unidad de la presentacion');
          }

          const internalCode =
            dto.internalCode?.trim() ?? (await this.codes.next(tx, ctx.tenantId));

          const product = await tx.product.create({
            data: {
              tenantId: ctx.tenantId,
              internalCode,
              barcode: dto.barcode?.trim() ?? null,
              name: dto.name.trim(),
              description: dto.description ?? null,
              categoryId: dto.categoryId ?? null,
              brandId: dto.brandId ?? null,
              baseUnitId: dto.baseUnitId,
            },
          });

          if (presentations.length > 0) {
            const defaultIndex = resolveDefaultIndex(presentations);
            for (const [index, p] of presentations.entries()) {
              await tx.productPresentation.create({
                data: {
                  tenantId: ctx.tenantId,
                  productId: product.id,
                  unitId: p.unitId,
                  name: p.name.trim(),
                  conversionFactor: p.conversionFactor,
                  salePrice: p.salePrice,
                  isDefault: index === defaultIndex,
                },
              });
            }
          }

          await this.audit.record(tx, ctx, {
            action: AUDIT_ACTIONS.PRODUCT_CREATED,
            entityType: 'Product',
            entityId: product.id,
            metadata: { internalCode, name: product.name, presentations: presentations.length },
          });

          return product.id;
        });
        return this.get(ctx, id);
      } catch (error) {
        const collision = classifyUnique(error);
        if (collision === 'internalCode' && !dto.internalCode && attempt < MAX_CODE_RETRIES) {
          continue;
        }
        throw toDomainError(error);
      }
    }
  }

  async update(ctx: RequestContext, id: string, dto: UpdateProductDto): Promise<ProductDetailView> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }
    const presentationCount = await this.prisma.productPresentation.count({
      where: { tenantId: ctx.tenantId, productId: id },
    });

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.barcode !== undefined) {
      data.barcode = dto.barcode ? dto.barcode.trim() : null;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.categoryId !== undefined) {
          if (dto.categoryId === null) {
            data.category = { disconnect: true };
          } else {
            await assertCatalogRef(tx, ctx.tenantId, 'category', dto.categoryId, 'La categoria');
            data.category = { connect: { id: dto.categoryId } };
          }
        }
        if (dto.brandId !== undefined) {
          if (dto.brandId === null) {
            data.brand = { disconnect: true };
          } else {
            await assertCatalogRef(tx, ctx.tenantId, 'brand', dto.brandId, 'La marca');
            data.brand = { connect: { id: dto.brandId } };
          }
        }
        if (dto.baseUnitId !== undefined && dto.baseUnitId !== product.baseUnitId) {
          if (presentationCount > 0) {
            throw new BusinessRuleException(
              ERROR_CODES.BUSINESS_RULE_VIOLATION,
              'No se puede cambiar la unidad base de un producto con presentaciones.',
            );
          }
          await assertCatalogRef(tx, ctx.tenantId, 'unit', dto.baseUnitId, 'La unidad base');
          data.baseUnit = { connect: { id: dto.baseUnitId } };
        }

        await tx.product.update({ where: { id }, data });
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.PRODUCT_UPDATED,
          entityType: 'Product',
          entityId: id,
          metadata: { fields: Object.keys(dto) },
        });
      });
    } catch (error) {
      throw toDomainError(error);
    }
    return this.get(ctx, id);
  }

  async setStatus(
    ctx: RequestContext,
    tenantCtx: TenantContext,
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<ProductDetailView> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }
    if (product.status === status) {
      return this.get(ctx, id);
    }

    await this.prisma.$transaction(async (tx) => {
      if (status === 'ACTIVE') {
        await this.assertWithinProductLimit(tx, ctx.tenantId, tenantCtx);
      }
      await tx.product.update({ where: { id }, data: { status } });
      await this.audit.record(tx, ctx, {
        action:
          status === 'ACTIVE' ? AUDIT_ACTIONS.PRODUCT_ACTIVATED : AUDIT_ACTIONS.PRODUCT_DEACTIVATED,
        entityType: 'Product',
        entityId: id,
      });
    });
    return this.get(ctx, id);
  }

  /** Cuenta productos ACTIVE del tenant y aplica el limite del plan (docs/05 1721-1740). */
  private async assertWithinProductLimit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    tenantCtx: TenantContext,
  ): Promise<void> {
    const active = await tx.product.count({ where: { tenantId, status: 'ACTIVE' } });
    this.limits.assertWithinLimit(tenantCtx, MAX_PRODUCTS_LIMIT_KEY, active);
  }
}

// --- helpers de modulo ------------------------------------------------------

type CatalogRefKind = 'unit' | 'category' | 'brand';

async function assertCatalogRef(
  tx: Prisma.TransactionClient,
  tenantId: string,
  kind: CatalogRefKind,
  id: string,
  label: string,
): Promise<void> {
  const where = { id, tenantId, status: 'ACTIVE' as const };
  const found =
    kind === 'unit'
      ? await tx.unit.findFirst({ where, select: { id: true } })
      : kind === 'category'
        ? await tx.category.findFirst({ where, select: { id: true } })
        : await tx.brand.findFirst({ where, select: { id: true } });
  if (!found) {
    throw new BusinessRuleException(
      ERROR_CODES.BUSINESS_RULE_VIOLATION,
      `${label} no existe, no pertenece al tenant o esta inactiva.`,
    );
  }
}

function validatePresentationInputs(presentations: CreatePresentationDto[]): void {
  let defaults = 0;
  const names = new Set<string>();
  for (const p of presentations) {
    if (Number(p.conversionFactor) <= 0) {
      throw new BusinessRuleException(
        ERROR_CODES.INVALID_PRESENTATION,
        'El factor de conversion debe ser mayor que cero.',
      );
    }
    if (Number(p.salePrice) < 0) {
      throw new BusinessRuleException(
        ERROR_CODES.INVALID_PRESENTATION,
        'El precio de venta no puede ser negativo.',
      );
    }
    const key = p.name.trim().toLowerCase();
    if (names.has(key)) {
      throw new BusinessRuleException(
        ERROR_CODES.INVALID_PRESENTATION,
        `Presentacion duplicada: "${p.name.trim()}".`,
      );
    }
    names.add(key);
    if (p.isDefault) {
      defaults += 1;
    }
  }
  if (defaults > 1) {
    throw new BusinessRuleException(
      ERROR_CODES.INVALID_PRESENTATION,
      'Solo una presentacion puede ser la principal.',
    );
  }
}

function resolveDefaultIndex(presentations: CreatePresentationDto[]): number {
  const explicit = presentations.findIndex((p) => p.isDefault);
  return explicit === -1 ? 0 : explicit;
}

/** Distingue que indice unico se violo. */
function classifyUnique(error: unknown): 'internalCode' | 'barcode' | null {
  if (!isUniqueViolation(error)) {
    return null;
  }
  const target = uniqueTarget(error);
  if (target.includes('internal_code') || target.includes('internalCode')) {
    return 'internalCode';
  }
  if (target.includes('barcode')) {
    return 'barcode';
  }
  return null;
}

function toDomainError(error: unknown): unknown {
  const collision = classifyUnique(error);
  if (collision === 'internalCode') {
    return new ConflictException(
      ERROR_CODES.PRODUCT_CODE_TAKEN,
      'El codigo interno ya existe en este tenant.',
    );
  }
  if (collision === 'barcode') {
    return new ConflictException(
      ERROR_CODES.PRODUCT_BARCODE_TAKEN,
      'El codigo de barras ya existe en este tenant.',
    );
  }
  if (isUniqueViolation(error)) {
    return new ConflictException(
      ERROR_CODES.PRODUCT_CODE_TAKEN,
      'Ya existe un producto con esos datos unicos en este tenant.',
    );
  }
  return error;
}
