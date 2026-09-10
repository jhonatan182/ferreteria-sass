import { Injectable } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { AUDIT_ACTIONS } from '../audit/audit-actions.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundException } from '../common/errors.js';
import { Prisma } from '../generated/prisma/client.js';
import type { InventoryMovementType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangeCostDto } from './dto/change-cost.dto.js';
import type { CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import type { KardexQuery } from './dto/kardex.query.js';
import type { ListInventoryQuery } from './dto/list-inventory.query.js';
import {
  COST_SCALE,
  QUANTITY_SCALE,
  ensureBalanceWithinTx,
  lockBalanceWithinTx,
  recordMovementWithinTx,
  splitInOut,
  toDecimal,
  type MovementResult,
} from './inventory.core.js';
import type {
  AdjustmentResultView,
  InventoryBalanceListItemView,
  KardexEntryView,
  ProductInventoryView,
} from './inventory.views.js';

const ZERO = new Prisma.Decimal(0);

/** Parametros de una entrada / salida de inventario reutilizable por Compras y Ventas. */
export interface StockChangeParams {
  productId: string;
  /** Magnitud positiva en unidad base. */
  baseQuantity: Prisma.Decimal | string | number;
  /** Cantidad capturada (magnitud) en su unidad. En unidad base == baseQuantity. */
  quantity: Prisma.Decimal | string | number;
  unitId: string;
  type: InventoryMovementType;
  /** Solo entradas de compra: recalcula el promedio ponderado. */
  unitCost?: Prisma.Decimal | string | number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
}

/**
 * Casos de uso de inventario (docs/04 616-693, docs/05 626-746, docs/06 244-288).
 *
 * El backend es la autoridad (AGENTS.md 4): el `tenantId` sale del contexto,
 * nunca del cliente; el stock negativo se rechaza DENTRO de la transaccion; el
 * balance se materializa solo a traves de un `InventoryMovement`.
 *
 * Los metodos `*WithinTx` son los PRIMITIVOS reutilizables: Compras y Ventas
 * abriran su propia transaccion grande y los invocaran en lugar de reimplementar
 * la logica de stock (docs/07 308-345).
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Primitivos de dominio (para Compras / Ventas y para el hook de productos) ---

  /** Crea el balance en cero si no existe. Idempotente y seguro bajo concurrencia. */
  async ensureBalanceWithinTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
  ): Promise<void> {
    await ensureBalanceWithinTx(tx, tenantId, productId);
  }

  /** Entrada de existencia (compra, devolucion de proveedor, ajuste positivo). */
  async increaseWithinTx(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    p: StockChangeParams,
  ): Promise<MovementResult> {
    return recordMovementWithinTx(tx, {
      tenantId: ctx.tenantId,
      productId: p.productId,
      type: p.type,
      quantity: p.quantity,
      unitId: p.unitId,
      baseQuantityDelta: toDecimal(p.baseQuantity).abs(),
      unitCost: p.unitCost ?? null,
      reason: p.reason ?? null,
      referenceType: p.referenceType ?? null,
      referenceId: p.referenceId ?? null,
      userId: ctx.userId,
    });
  }

  /** Salida de existencia (venta, devolucion de venta, ajuste negativo). No toca el costo. */
  async decreaseWithinTx(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    p: StockChangeParams,
  ): Promise<MovementResult> {
    return recordMovementWithinTx(tx, {
      tenantId: ctx.tenantId,
      productId: p.productId,
      type: p.type,
      quantity: p.quantity,
      unitId: p.unitId,
      baseQuantityDelta: toDecimal(p.baseQuantity).abs().neg(),
      unitCost: null,
      reason: p.reason ?? null,
      referenceType: p.referenceType ?? null,
      referenceId: p.referenceId ?? null,
      userId: ctx.userId,
    });
  }

  /**
   * Ajuste manual: movimiento (ADJUSTMENT_IN/OUT) + fila `InventoryAdjustment` +
   * `AuditLog`, todo en la transaccion recibida. El costo promedio NO se toca
   * (docs/04 seccion 46).
   */
  async adjustWithinTx(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    p: {
      productId: string;
      direction: 'IN' | 'OUT';
      baseQuantity: string;
      unitId: string;
      reason: string;
    },
  ): Promise<{ adjustmentId: string; movement: MovementResult }> {
    const magnitude = toDecimal(p.baseQuantity).abs();
    const common: StockChangeParams = {
      productId: p.productId,
      baseQuantity: magnitude,
      quantity: magnitude,
      unitId: p.unitId,
      reason: p.reason,
      type: p.direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
    };
    const movement =
      p.direction === 'IN'
        ? await this.increaseWithinTx(tx, ctx, common)
        : await this.decreaseWithinTx(tx, ctx, common);

    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        tenantId: ctx.tenantId,
        productId: p.productId,
        direction: p.direction,
        quantity: magnitude.toFixed(QUANTITY_SCALE),
        reason: p.reason,
        movementId: movement.id,
        createdById: ctx.userId,
      },
      select: { id: true },
    });

    await this.audit.record(tx, ctx, {
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: 'InventoryAdjustment',
      entityId: adjustment.id,
      metadata: {
        productId: p.productId,
        direction: p.direction,
        quantity: magnitude.toFixed(QUANTITY_SCALE),
        reason: p.reason,
        previousQuantity: movement.previousQuantity,
        resultingQuantity: movement.resultingQuantity,
      },
    });

    return { adjustmentId: adjustment.id, movement };
  }

  // --- Endpoints -------------------------------------------------------------

  /** `POST /inventory/adjustments` (permiso `inventory.adjust`). */
  async adjustManual(ctx: RequestContext, dto: CreateAdjustmentDto): Promise<AdjustmentResultView> {
    const product = await this.loadProductOrThrow(ctx, dto.productId);
    const baseQuantity = toDecimal(dto.quantity).toFixed(QUANTITY_SCALE);

    const { adjustmentId, movement } = await this.prisma.$transaction((tx) =>
      this.adjustWithinTx(tx, ctx, {
        productId: product.id,
        direction: dto.direction,
        baseQuantity,
        unitId: product.baseUnitId,
        reason: dto.reason.trim(),
      }),
    );

    return {
      adjustmentId,
      movementId: movement.id,
      productId: product.id,
      internalCode: product.internalCode,
      name: product.name,
      direction: dto.direction,
      quantity: toDecimal(baseQuantity).toString(),
      previousQuantity: movement.previousQuantity,
      resultingQuantity: movement.resultingQuantity,
      averageCost: movement.averageCost,
    };
  }

  /** `POST /inventory/products/:productId/cost` (permiso `products.change_cost`). */
  async changeCost(
    ctx: RequestContext,
    productId: string,
    dto: ChangeCostDto,
  ): Promise<ProductInventoryView> {
    await this.loadProductOrThrow(ctx, productId);
    const newCost = toDecimal(dto.averageCost).toFixed(COST_SCALE);

    await this.prisma.$transaction(async (tx) => {
      await ensureBalanceWithinTx(tx, ctx.tenantId, productId);
      const balance = await lockBalanceWithinTx(tx, ctx.tenantId, productId);
      const previousCost = balance.averageCost.toFixed(COST_SCALE);

      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { averageCost: newCost },
      });

      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.PRODUCT_COST_CHANGED,
        entityType: 'Product',
        entityId: productId,
        metadata: { previousCost, newCost, reason: dto.reason.trim() },
      });
    });

    return this.getProductInventory(ctx, productId);
  }

  // --- Consultas ------------------------------------------------------------

  /** `GET /inventory` — existencias del tenant, guiado por Product (RF-060). */
  async list(
    ctx: RequestContext,
    query: ListInventoryQuery,
  ): Promise<Paginated<InventoryBalanceListItemView>> {
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
    if (query.stock === 'with') {
      where.inventoryBalances = { some: { quantity: { gt: 0 } } };
    } else if (query.stock === 'without') {
      where.inventoryBalances = { none: { quantity: { gt: 0 } } };
    }

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { baseUnit: { select: { code: true } } },
      }),
    ]);

    const balances = await this.prisma.inventoryBalance.findMany({
      where: { tenantId: ctx.tenantId, productId: { in: products.map((p) => p.id) } },
    });
    const balanceByProduct = new Map(balances.map((b) => [b.productId, b] as const));

    return {
      items: products.map((product) => {
        const balance = balanceByProduct.get(product.id);
        const quantity = balance?.quantity ?? ZERO;
        const averageCost = balance?.averageCost ?? ZERO;
        return {
          productId: product.id,
          internalCode: product.internalCode,
          barcode: product.barcode,
          name: product.name,
          status: product.status,
          baseUnitCode: product.baseUnit.code,
          quantity: quantity.toString(),
          averageCost: averageCost.toString(),
          inventoryValue: quantity.mul(averageCost).toFixed(2),
        };
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** `GET /inventory/products/:productId` — existencia + costo de un producto. Nunca escribe. */
  async getProductInventory(ctx: RequestContext, productId: string): Promise<ProductInventoryView> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: ctx.tenantId },
      include: { baseUnit: { select: { code: true } } },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }
    const balance = await this.prisma.inventoryBalance.findUnique({
      where: { tenantId_productId: { tenantId: ctx.tenantId, productId } },
    });
    const quantity = balance?.quantity ?? ZERO;
    const averageCost = balance?.averageCost ?? ZERO;
    return {
      productId: product.id,
      internalCode: product.internalCode,
      name: product.name,
      status: product.status,
      baseUnitId: product.baseUnitId,
      baseUnitCode: product.baseUnit.code,
      quantity: quantity.toString(),
      averageCost: averageCost.toString(),
      inventoryValue: quantity.mul(averageCost).toFixed(2),
      updatedAt: balance?.updatedAt.toISOString() ?? null,
    };
  }

  /** `GET /inventory/products/:productId/kardex` — historial de movimientos (RF-062). */
  async kardex(
    ctx: RequestContext,
    productId: string,
    query: KardexQuery,
  ): Promise<Paginated<KardexEntryView>> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }

    const where: Prisma.InventoryMovementWhereInput = { tenantId: ctx.tenantId, productId };
    if (query.type) {
      where.type = query.type;
    }
    const createdAt = dateRange(query.from, query.to);
    if (createdAt) {
      where.createdAt = createdAt;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { unit: { select: { code: true } }, user: { select: { name: true } } },
      }),
    ]);

    return {
      items: rows.map((row) => {
        const { entrada, salida } = splitInOut(row.baseQuantity);
        return {
          id: row.id,
          date: row.createdAt.toISOString(),
          type: row.type,
          entrada,
          salida,
          saldo: row.resultingQuantity.toString(),
          unitCode: row.unit.code,
          unitCost: row.unitCost?.toString() ?? null,
          userName: row.user?.name ?? null,
          referenceType: row.referenceType,
          referenceId: row.referenceId,
          reason: row.reason,
        };
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // --- helpers privados --------------------------------------------------

  private async loadProductOrThrow(ctx: RequestContext, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: ctx.tenantId },
      select: { id: true, internalCode: true, name: true, baseUnitId: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return product;
  }
}

/** Rango `createdAt` para el kardex. Una fecha `to` sin hora cubre el dia completo. */
function dateRange(from?: string, to?: string): Prisma.InventoryMovementWhereInput['createdAt'] {
  if (!from && !to) {
    return undefined;
  }
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) {
    filter.gte = new Date(from);
  }
  if (to) {
    filter.lte = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999Z`) : new Date(to);
  }
  return filter;
}
