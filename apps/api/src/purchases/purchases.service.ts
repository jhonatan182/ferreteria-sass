/* oxlint-disable no-await-in-loop -- las lineas de una compra se procesan en
   serie DENTRO de una sola transaccion: cada entrada de inventario bloquea el
   balance del producto (SELECT ... FOR UPDATE) y debe verse la anterior. */
import { Injectable } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { AUDIT_ACTIONS } from '../audit/audit-actions.js';
import { AuditService } from '../audit/audit.service.js';
import {
  AppException,
  BusinessRuleException,
  ConflictException,
  ERROR_CODES,
  NotFoundException,
} from '../common/errors.js';
import { isUniqueViolation } from '../common/prisma-error.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PurchaseStatus } from '../generated/prisma/client.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePurchaseDto } from './dto/create-purchase.dto.js';
import type { CancelPurchaseDto } from './dto/cancel-purchase.dto.js';
import type { ListPurchasesQuery } from './dto/list-purchases.query.js';
import type { PurchaseItemDto } from './dto/purchase-item.dto.js';
import type { UpdatePurchaseDto } from './dto/update-purchase.dto.js';
import {
  COST_SCALE,
  MONEY_SCALE,
  QUANTITY_SCALE,
  computeItemAmounts,
  computePurchaseTotals,
  isNegative,
  isNonPositive,
} from './purchases.core.js';
import type {
  PurchaseDetailView,
  PurchaseItemView,
  PurchaseListItemView,
} from './purchases.views.js';

/** Referencia estable del movimiento de inventario originado por una compra (docs/05 1986-2016). */
const PURCHASE_REFERENCE_TYPE = 'PURCHASE';

/** Linea resuelta contra el catalogo actual: magnitudes de inventario ya calculadas. */
interface ResolvedItem {
  productId: string;
  presentationId: string | null;
  unitId: string;
  quantity: string;
  conversionFactor: string;
  baseQuantity: string;
  unitCost: string;
  unitBaseCost: string;
  subtotal: string;
}

/**
 * Casos de uso de Purchase (docs/04 789-841, docs/05 459-630, docs/06 310-353).
 *
 * El backend es la autoridad (AGENTS.md 4, 18): el `tenantId` sale del contexto;
 * los totales, `baseQuantity`, `conversionFactor` y el costo por unidad base se
 * RECALCULAN aqui a partir de los datos persistidos, nunca de lo que envia el
 * frontend.
 *
 * `complete` y `cancel` son transaccionales (RN-029/RN-030, RF-160) y reutilizan
 * `InventoryService` para el stock y el costo promedio ponderado: no se
 * reimplementa nada de inventario (docs/07 308-322).
 */
@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
  ) {}

  // --- Consultas ----------------------------------------------------------

  async list(
    ctx: RequestContext,
    query: ListPurchasesQuery,
  ): Promise<Paginated<PurchaseListItemView>> {
    const where: Prisma.PurchaseWhereInput = { tenantId: ctx.tenantId };
    if (query.status !== 'all') {
      where.status = query.status;
    }
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }
    const purchaseDate = dateRange(query.from, query.to);
    if (purchaseDate) {
      where.purchaseDate = purchaseDate;
    }
    const search = query.search?.trim();
    if (search) {
      where.documentNumber = { contains: search, mode: 'insensitive' };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.findMany({
        where,
        orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          supplier: { select: { name: true } },
          items: { select: { id: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        purchaseDate: row.purchaseDate.toISOString(),
        documentNumber: row.documentNumber,
        supplierId: row.supplierId,
        supplierName: row.supplier.name,
        total: row.total.toString(),
        itemCount: row.items.length,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(ctx: RequestContext, id: string): Promise<PurchaseDetailView> {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        supplier: { select: { name: true, isActive: true } },
        createdBy: { select: { name: true } },
        completedBy: { select: { name: true } },
        cancelledBy: { select: { name: true } },
        items: {
          orderBy: [{ createdAt: 'asc' }],
          include: {
            product: { select: { internalCode: true, name: true } },
            presentation: { select: { name: true } },
            unit: { select: { code: true } },
          },
        },
      },
    });
    if (!purchase) {
      throw new NotFoundException('Compra no encontrada.');
    }

    return {
      id: purchase.id,
      status: purchase.status,
      purchaseDate: purchase.purchaseDate.toISOString(),
      documentNumber: purchase.documentNumber,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier.name,
      supplierIsActive: purchase.supplier.isActive,
      subtotal: purchase.subtotal.toString(),
      discount: purchase.discount.toString(),
      tax: purchase.tax.toString(),
      total: purchase.total.toString(),
      notes: purchase.notes,
      createdByUserId: purchase.createdByUserId,
      createdByName: purchase.createdBy.name,
      createdAt: purchase.createdAt.toISOString(),
      completedByUserId: purchase.completedByUserId,
      completedByName: purchase.completedBy?.name ?? null,
      completedAt: purchase.completedAt?.toISOString() ?? null,
      cancelledByUserId: purchase.cancelledByUserId,
      cancelledByName: purchase.cancelledBy?.name ?? null,
      cancelledAt: purchase.cancelledAt?.toISOString() ?? null,
      cancellationReason: purchase.cancellationReason,
      updatedAt: purchase.updatedAt.toISOString(),
      items: purchase.items.map((item): PurchaseItemView => ({
        id: item.id,
        productId: item.productId,
        productInternalCode: item.product.internalCode,
        productName: item.product.name,
        presentationId: item.presentationId,
        presentationName: item.presentation?.name ?? null,
        unitCode: item.unit.code,
        quantity: item.quantity.toString(),
        conversionFactor: item.conversionFactor.toString(),
        baseQuantity: item.baseQuantity.toString(),
        unitCost: item.unitCost.toString(),
        unitBaseCost: item.unitBaseCost.toString(),
        subtotal: item.subtotal.toString(),
      })),
    };
  }

  // --- Borrador ---------------------------------------------------------

  /** `POST /purchases` — crea la compra en DRAFT (RF-080). No toca inventario. */
  async create(ctx: RequestContext, dto: CreatePurchaseDto): Promise<PurchaseDetailView> {
    const discount = normalizeMoney(dto.discount);
    const tax = normalizeMoney(dto.tax);

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        await this.assertSupplierExists(tx, ctx.tenantId, dto.supplierId);
        const resolved = await this.resolveItems(tx, ctx.tenantId, dto.items);
        const totals = computePurchaseTotals({
          itemSubtotals: resolved.map((r) => r.subtotal),
          discount,
          tax,
        });
        assertTotalNotNegative(totals.total);

        const purchase = await tx.purchase.create({
          data: {
            tenantId: ctx.tenantId,
            supplierId: dto.supplierId,
            status: 'DRAFT',
            purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
            documentNumber: cleanText(dto.documentNumber),
            discount,
            tax,
            subtotal: totals.subtotal,
            total: totals.total,
            notes: cleanText(dto.notes),
            createdByUserId: ctx.userId,
          },
        });
        await this.insertItems(tx, ctx.tenantId, purchase.id, resolved);
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.PURCHASE_CREATED,
          entityType: 'Purchase',
          entityId: purchase.id,
          metadata: { supplierId: dto.supplierId, itemCount: resolved.length, total: totals.total },
        });
        return purchase.id;
      });
      return this.get(ctx, id);
    } catch (error) {
      throw translateUnique(error);
    }
  }

  /** `PATCH /purchases/:id` — edita un borrador (RF-081). Solo estado DRAFT (RF-083). */
  async update(
    ctx: RequestContext,
    id: string,
    dto: UpdatePurchaseDto,
  ): Promise<PurchaseDetailView> {
    await this.loadOrThrow(ctx, id);

    try {
      await this.prisma.$transaction(async (tx) => {
        const locked = await lockPurchaseWithinTx(tx, ctx.tenantId, id);
        if (!locked) {
          throw new NotFoundException('Compra no encontrada.');
        }
        assertDraft(locked.status);

        const current = await tx.purchase.findUniqueOrThrow({
          where: { id },
          include: { items: { select: { subtotal: true } } },
        });

        const data: Prisma.PurchaseUpdateInput = {};
        if (dto.supplierId !== undefined) {
          await this.assertSupplierExists(tx, ctx.tenantId, dto.supplierId);
          data.supplier = { connect: { id: dto.supplierId } };
        }
        if (dto.purchaseDate !== undefined) {
          data.purchaseDate = new Date(dto.purchaseDate);
        }
        if (dto.documentNumber !== undefined) {
          data.documentNumber = cleanText(dto.documentNumber);
        }
        if (dto.notes !== undefined) {
          data.notes = cleanText(dto.notes);
        }

        const discount =
          dto.discount !== undefined
            ? normalizeMoney(dto.discount)
            : current.discount.toFixed(MONEY_SCALE);
        const tax =
          dto.tax !== undefined ? normalizeMoney(dto.tax) : current.tax.toFixed(MONEY_SCALE);

        let itemSubtotals: string[];
        if (dto.items !== undefined) {
          const resolved = await this.resolveItems(tx, ctx.tenantId, dto.items);
          await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
          await this.insertItems(tx, ctx.tenantId, id, resolved);
          itemSubtotals = resolved.map((r) => r.subtotal);
        } else {
          itemSubtotals = current.items.map((i) => i.subtotal.toFixed(MONEY_SCALE));
        }

        const totals = computePurchaseTotals({ itemSubtotals, discount, tax });
        assertTotalNotNegative(totals.total);

        data.discount = discount;
        data.tax = tax;
        data.subtotal = totals.subtotal;
        data.total = totals.total;

        await tx.purchase.update({ where: { id }, data });
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.PURCHASE_UPDATED,
          entityType: 'Purchase',
          entityId: id,
          metadata: { fields: Object.keys(dto) },
        });
      });
    } catch (error) {
      throw translateUnique(error);
    }
    return this.get(ctx, id);
  }

  // --- Finalizacion -----------------------------------------------------

  /**
   * `POST /purchases/:id/complete` — aplica los efectos en UNA transaccion
   * (docs/05 512-563, docs/07 308-322):
   *   bloquear la compra -> validar DRAFT (idempotencia, RF-171) -> proveedor
   *   activo -> items -> productos/presentaciones -> convertir -> entrada de
   *   inventario + promedio ponderado (InventoryService) -> recalcular totales
   *   -> marcar COMPLETED -> auditoria.
   * Si algo falla, rollback total (RF-160).
   */
  async complete(ctx: RequestContext, id: string): Promise<PurchaseDetailView> {
    const preview = await this.loadOrThrow(ctx, id);
    assertDraft(preview.status);

    await this.prisma.$transaction(async (tx) => {
      const locked = await lockPurchaseWithinTx(tx, ctx.tenantId, id);
      if (!locked) {
        throw new NotFoundException('Compra no encontrada.');
      }
      // Idempotencia: una peticion concurrente que llegue aqui ve COMPLETED y sale.
      assertDraft(locked.status);

      const purchase = await tx.purchase.findUniqueOrThrow({
        where: { id },
        include: {
          supplier: { select: { isActive: true } },
          items: { orderBy: [{ createdAt: 'asc' }] },
        },
      });
      if (!purchase.supplier.isActive) {
        throw new BusinessRuleException(
          ERROR_CODES.SUPPLIER_INACTIVE,
          'El proveedor de la compra esta inactivo.',
        );
      }
      if (purchase.items.length === 0) {
        throw new BusinessRuleException(
          ERROR_CODES.PURCHASE_EMPTY,
          'No se puede completar una compra sin items.',
        );
      }

      const resolved = await this.resolveItems(
        tx,
        ctx.tenantId,
        purchase.items.map((i) => ({
          productId: i.productId,
          presentationId: i.presentationId ?? undefined,
          quantity: i.quantity.toString(),
          unitCost: i.unitCost.toString(),
        })),
      );

      for (const [index, r] of resolved.entries()) {
        await tx.purchaseItem.update({
          where: { id: purchase.items[index].id },
          data: {
            unitId: r.unitId,
            conversionFactor: r.conversionFactor,
            baseQuantity: r.baseQuantity,
            unitBaseCost: r.unitBaseCost,
            subtotal: r.subtotal,
          },
        });
        await this.inventory.increaseWithinTx(tx, ctx, {
          productId: r.productId,
          baseQuantity: r.baseQuantity,
          quantity: r.quantity,
          unitId: r.unitId,
          type: 'PURCHASE',
          unitCost: r.unitBaseCost,
          referenceType: PURCHASE_REFERENCE_TYPE,
          referenceId: id,
          reason: 'Entrada por compra',
        });
      }

      const totals = computePurchaseTotals({
        itemSubtotals: resolved.map((r) => r.subtotal),
        discount: purchase.discount,
        tax: purchase.tax,
      });
      assertTotalNotNegative(totals.total);

      await tx.purchase.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedByUserId: ctx.userId,
          completedAt: new Date(),
          subtotal: totals.subtotal,
          total: totals.total,
        },
      });

      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.PURCHASE_COMPLETED,
        entityType: 'Purchase',
        entityId: id,
        metadata: {
          supplierId: purchase.supplierId,
          itemCount: resolved.length,
          subtotal: totals.subtotal,
          total: totals.total,
        },
      });
    });

    return this.get(ctx, id);
  }

  /**
   * `POST /purchases/:id/cancel` — reversa una compra completada (docs/05 589-627,
   * RF-084). Requiere motivo. Genera una salida compensatoria de inventario por
   * cada linea (type REVERSAL). Si la reversion dejaria la existencia negativa,
   * se RECHAZA (no se inventa stock negativo) — `PURCHASE_CANCELLATION_STOCK_CONFLICT`.
   * El costo promedio NO se recalcula retrospectivamente (politica V1, docs/04 seccion 47).
   */
  async cancel(
    ctx: RequestContext,
    id: string,
    dto: CancelPurchaseDto,
  ): Promise<PurchaseDetailView> {
    await this.loadOrThrow(ctx, id);
    const reason = dto.reason.trim();

    await this.prisma.$transaction(async (tx) => {
      const locked = await lockPurchaseWithinTx(tx, ctx.tenantId, id);
      if (!locked) {
        throw new NotFoundException('Compra no encontrada.');
      }
      // Idempotencia: solo una COMPLETED puede cancelarse; una 2a peticion ve CANCELLED.
      if (locked.status !== 'COMPLETED') {
        throw new ConflictException(
          ERROR_CODES.PURCHASE_NOT_COMPLETED,
          'Solo se puede cancelar una compra completada.',
        );
      }

      const items = await tx.purchaseItem.findMany({
        where: { purchaseId: id },
        orderBy: [{ createdAt: 'asc' }],
      });

      for (const item of items) {
        try {
          await this.inventory.decreaseWithinTx(tx, ctx, {
            productId: item.productId,
            baseQuantity: item.baseQuantity,
            quantity: item.baseQuantity,
            unitId: item.unitId,
            type: 'REVERSAL',
            referenceType: PURCHASE_REFERENCE_TYPE,
            referenceId: id,
            reason: 'Reverso por cancelacion de compra',
          });
        } catch (error) {
          if (error instanceof AppException && error.code === ERROR_CODES.INSUFFICIENT_STOCK) {
            throw new BusinessRuleException(
              ERROR_CODES.PURCHASE_CANCELLATION_STOCK_CONFLICT,
              'No se puede cancelar automaticamente: revertir la compra dejaria la existencia negativa. Resuelva la situacion con los flujos de inventario apropiados antes de cancelar.',
              { productId: item.productId },
            );
          }
          throw error;
        }
      }

      await tx.purchase.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledByUserId: ctx.userId,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.PURCHASE_CANCELLED,
        entityType: 'Purchase',
        entityId: id,
        metadata: { reason, itemCount: items.length },
      });
    });

    return this.get(ctx, id);
  }

  // --- helpers privados ------------------------------------------------

  private async loadOrThrow(ctx: RequestContext, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, status: true },
    });
    if (!purchase) {
      throw new NotFoundException('Compra no encontrada.');
    }
    return purchase;
  }

  private async assertSupplierExists(
    tx: Prisma.TransactionClient,
    tenantId: string,
    supplierId: string,
  ): Promise<void> {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, tenantId },
      select: { id: true },
    });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado.');
    }
  }

  /**
   * Resuelve cada linea contra el catalogo ACTUAL del tenant y calcula sus
   * magnitudes (AGENTS.md 4). Usado tanto para el borrador (preliminar) como
   * para la finalizacion (autoritativo: congela los valores del momento).
   */
  private async resolveItems(
    tx: Prisma.TransactionClient,
    tenantId: string,
    items: Array<
      Pick<PurchaseItemDto, 'productId' | 'quantity' | 'unitCost'> & { presentationId?: string }
    >,
  ): Promise<ResolvedItem[]> {
    const resolved: ResolvedItem[] = [];
    for (const item of items) {
      if (isNonPositive(item.quantity)) {
        throw new BusinessRuleException(
          ERROR_CODES.INVALID_PURCHASE_ITEM,
          'La cantidad de cada linea debe ser mayor que cero.',
        );
      }
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId, status: 'ACTIVE' },
        select: { id: true, baseUnitId: true },
      });
      if (!product) {
        throw new BusinessRuleException(
          ERROR_CODES.INVALID_PURCHASE_ITEM,
          'Un producto de la compra no existe, esta inactivo o no pertenece al tenant.',
          { productId: item.productId },
        );
      }

      let unitId = product.baseUnitId;
      let conversionFactor = '1';
      if (item.presentationId) {
        const presentation = await tx.productPresentation.findFirst({
          where: {
            id: item.presentationId,
            tenantId,
            productId: item.productId,
            status: 'ACTIVE',
          },
          select: { unitId: true, conversionFactor: true },
        });
        if (!presentation) {
          throw new BusinessRuleException(
            ERROR_CODES.INVALID_PURCHASE_ITEM,
            'Una presentacion de la compra no existe, esta inactiva o no pertenece al producto.',
            { presentationId: item.presentationId },
          );
        }
        unitId = presentation.unitId;
        conversionFactor = presentation.conversionFactor.toFixed(COST_SCALE);
      }

      const amounts = computeItemAmounts({
        quantity: item.quantity,
        conversionFactor,
        unitCost: item.unitCost,
      });
      resolved.push({
        productId: item.productId,
        presentationId: item.presentationId ?? null,
        unitId,
        quantity: new Prisma.Decimal(item.quantity).toFixed(QUANTITY_SCALE),
        conversionFactor: new Prisma.Decimal(conversionFactor).toFixed(COST_SCALE),
        baseQuantity: amounts.baseQuantity,
        unitCost: new Prisma.Decimal(item.unitCost).toFixed(COST_SCALE),
        unitBaseCost: amounts.unitBaseCost,
        subtotal: amounts.subtotal,
      });
    }
    return resolved;
  }

  private async insertItems(
    tx: Prisma.TransactionClient,
    tenantId: string,
    purchaseId: string,
    resolved: ResolvedItem[],
  ): Promise<void> {
    await tx.purchaseItem.createMany({
      data: resolved.map((r) => ({
        tenantId,
        purchaseId,
        productId: r.productId,
        presentationId: r.presentationId,
        unitId: r.unitId,
        quantity: r.quantity,
        conversionFactor: r.conversionFactor,
        baseQuantity: r.baseQuantity,
        unitCost: r.unitCost,
        unitBaseCost: r.unitBaseCost,
        subtotal: r.subtotal,
      })),
    });
  }
}

// --- helpers de modulo ----------------------------------------------------

function assertDraft(status: PurchaseStatus): void {
  if (status !== 'DRAFT') {
    throw new ConflictException(
      ERROR_CODES.PURCHASE_NOT_DRAFT,
      'Solo una compra en borrador puede editarse o completarse.',
    );
  }
}

function assertTotalNotNegative(total: string): void {
  if (isNegative(total)) {
    throw new BusinessRuleException(
      ERROR_CODES.BUSINESS_RULE_VIOLATION,
      'El total de la compra no puede ser negativo (revise descuento e impuesto).',
    );
  }
}

/** `''`/espacios/undefined/null -> `null`. */
function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Normaliza dinero de cabecera a cadena con escala fija; `undefined` -> "0.0000". */
function normalizeMoney(value: string | undefined): string {
  return new Prisma.Decimal(value ?? 0).toFixed(MONEY_SCALE);
}

/**
 * Bloquea la fila de la compra para el resto de la transaccion (`FOR UPDATE`).
 * Serializa a los concurrentes: una segunda peticion de complete/cancel espera
 * al COMMIT de la primera y lee el estado ya cambiado (docs/07 348-368, RF-171).
 */
async function lockPurchaseWithinTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
): Promise<{ id: string; status: PurchaseStatus } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; status: PurchaseStatus }>>`
    SELECT id, status
      FROM purchases
     WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
     FOR UPDATE`;
  return rows[0] ?? null;
}

/** Rango `purchaseDate`. Una fecha `to` sin hora cubre el dia completo. */
function dateRange(from?: string, to?: string): Prisma.PurchaseWhereInput['purchaseDate'] {
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

/** P2002 sobre (tenant_id, document_number) -> codigo funcional estable. */
function translateUnique(error: unknown): unknown {
  if (isUniqueViolation(error)) {
    return new ConflictException(
      ERROR_CODES.PURCHASE_DOCUMENT_TAKEN,
      'Ya existe una compra con ese numero de documento en este tenant.',
    );
  }
  return error;
}
