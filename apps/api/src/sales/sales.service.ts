/* oxlint-disable no-await-in-loop -- las lineas de una venta se procesan en
   serie DENTRO de una sola transaccion: cada salida de inventario bloquea el
   balance del producto (SELECT ... FOR UPDATE) y debe verse la anterior. */
import { Injectable } from '@nestjs/common';
import type { Paginated, RequestContext } from '@ferreteria/types';

import { AUDIT_ACTIONS } from '../audit/audit-actions.js';
import { AuditService } from '../audit/audit.service.js';
import { FeatureService } from '../auth/feature.service.js';
import type { TenantContext } from '../auth/auth.types.js';
import {
  BusinessRuleException,
  ConflictException,
  ERROR_CODES,
  NotFoundException,
} from '../common/errors.js';
import { isUniqueViolation } from '../common/prisma-error.js';
import { CustomersService } from '../customers/customers.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CreditAccountStatus, SaleStatus } from '../generated/prisma/client.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CancelSaleDto } from './dto/cancel-sale.dto.js';
import type { CompleteSaleDto } from './dto/complete-sale.dto.js';
import type { CreateSaleDto } from './dto/create-sale.dto.js';
import type { ListSalesQuery } from './dto/list-sales.query.js';
import type { SaleItemDto } from './dto/sale-item.dto.js';
import type { UpdateSaleDto } from './dto/update-sale.dto.js';
import { SALE_REFERENCE_TYPE } from './sales.constants.js';
import {
  COST_SCALE,
  MONEY_SCALE,
  QUANTITY_SCALE,
  capturedUnitCost,
  computeSaleItemAmounts,
  computeSaleTotals,
  isNegative,
  isNonPositive,
  moneyEquals,
} from './sales.core.js';
import type { SaleDetailView, SaleItemView, SaleListItemView } from './sales.views.js';

/** Feature de plan que habilita las ventas al credito (docs/03 865-901, RF-013). */
const CREDITS_FEATURE = 'CREDITS';

/** Linea resuelta contra el catalogo actual: precio y magnitudes ya calculados. */
interface ResolvedItem {
  productId: string;
  presentationId: string | null;
  unitId: string;
  productName: string;
  presentationName: string | null;
  quantity: string;
  conversionFactor: string;
  baseQuantity: string;
  unitPrice: string;
  discount: string;
  subtotal: string;
}

/**
 * Casos de uso de Sale (docs/04 896-996, docs/05 830-1010, docs/06 380-449).
 *
 * El backend es la autoridad (AGENTS.md 4, 18): el `tenantId` y el actor salen
 * del contexto; el PRECIO se resuelve del `ProductPresentation`; los totales,
 * `baseQuantity` y `conversionFactor` se recalculan aqui, nunca desde el
 * frontend.
 *
 * `complete` y `cancel` son transaccionales (RN-034/RN-036, RF-160) y reutilizan
 * `InventoryService` para el stock y su proteccion de concurrencia: NO se
 * reimplementa nada de inventario (docs/07 300-345). La cancelacion usa un
 * movimiento compensatorio `REVERSAL` con costo nulo, que no altera el promedio
 * (politica coherente con docs/04 seccion 47 D10).
 */
@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly customers: CustomersService,
    private readonly feature: FeatureService,
  ) {}

  // --- Consultas ----------------------------------------------------------

  async list(ctx: RequestContext, query: ListSalesQuery): Promise<Paginated<SaleListItemView>> {
    const where: Prisma.SaleWhereInput = { tenantId: ctx.tenantId };
    if (query.status !== 'all') {
      where.status = query.status;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    const saleDate = dateRange(query.from, query.to);
    if (saleDate) {
      where.saleDate = saleDate;
    }
    const search = query.search?.trim();
    if (search) {
      where.documentNumber = { contains: search, mode: 'insensitive' };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        orderBy: [{ saleDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          customer: { select: { name: true } },
          items: { select: { id: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        saleDate: row.saleDate.toISOString(),
        documentNumber: row.documentNumber,
        customerId: row.customerId,
        customerName: row.customer.name,
        total: row.total.toString(),
        itemCount: row.items.length,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(ctx: RequestContext, id: string): Promise<SaleDetailView> {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        customer: { select: { name: true, isGeneralCustomer: true, isActive: true } },
        createdBy: { select: { name: true } },
        completedBy: { select: { name: true } },
        cancelledBy: { select: { name: true } },
        items: {
          orderBy: [{ createdAt: 'asc' }],
          include: { unit: { select: { code: true } } },
        },
        payments: { orderBy: [{ createdAt: 'asc' }] },
      },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada.');
    }

    return {
      id: sale.id,
      status: sale.status,
      saleDate: sale.saleDate.toISOString(),
      documentNumber: sale.documentNumber,
      customerId: sale.customerId,
      customerName: sale.customer.name,
      customerIsGeneral: sale.customer.isGeneralCustomer,
      customerIsActive: sale.customer.isActive,
      subtotal: sale.subtotal.toString(),
      discount: sale.discount.toString(),
      tax: sale.tax.toString(),
      total: sale.total.toString(),
      notes: sale.notes,
      createdByUserId: sale.createdByUserId,
      createdByName: sale.createdBy.name,
      createdAt: sale.createdAt.toISOString(),
      completedByUserId: sale.completedByUserId,
      completedByName: sale.completedBy?.name ?? null,
      completedAt: sale.completedAt?.toISOString() ?? null,
      cancelledByUserId: sale.cancelledByUserId,
      cancelledByName: sale.cancelledBy?.name ?? null,
      cancelledAt: sale.cancelledAt?.toISOString() ?? null,
      cancellationReason: sale.cancellationReason,
      updatedAt: sale.updatedAt.toISOString(),
      items: sale.items.map((item): SaleItemView => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        presentationId: item.presentationId,
        presentationName: item.presentationName,
        unitCode: item.unit.code,
        quantity: item.quantity.toString(),
        conversionFactor: item.conversionFactor.toString(),
        baseQuantity: item.baseQuantity.toString(),
        unitPrice: item.unitPrice.toString(),
        discount: item.discount.toString(),
        subtotal: item.subtotal.toString(),
        unitCost: item.unitCost?.toString() ?? null,
        unitBaseCost: item.unitBaseCost?.toString() ?? null,
      })),
      payments: sale.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amount.toString(),
        reference: p.reference,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  // --- Borrador ---------------------------------------------------------

  /** `POST /sales` — crea la venta en DRAFT (RF-100). No toca inventario/caja/credito. */
  async create(ctx: RequestContext, dto: CreateSaleDto): Promise<SaleDetailView> {
    const discount = normalizeMoney(dto.discount);
    const tax = normalizeMoney(dto.tax);
    const customerId = dto.customerId ?? (await this.customers.getGeneral(ctx)).id;

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        await this.assertCustomerUsable(tx, ctx.tenantId, customerId);
        const resolved = await this.resolveItems(tx, ctx.tenantId, dto.items);
        const totals = computeSaleTotals({
          itemSubtotals: resolved.map((r) => r.subtotal),
          discount,
          tax,
        });
        assertTotalNotNegative(totals.total);

        const sale = await tx.sale.create({
          data: {
            tenantId: ctx.tenantId,
            customerId,
            status: 'DRAFT',
            saleDate: dto.saleDate ? new Date(dto.saleDate) : new Date(),
            documentNumber: cleanText(dto.documentNumber),
            discount,
            tax,
            subtotal: totals.subtotal,
            total: totals.total,
            notes: cleanText(dto.notes),
            createdByUserId: ctx.userId,
          },
        });
        await this.insertItems(tx, ctx.tenantId, sale.id, resolved);
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.SALE_CREATED,
          entityType: 'Sale',
          entityId: sale.id,
          metadata: { customerId, itemCount: resolved.length, total: totals.total },
        });
        return sale.id;
      });
      return this.get(ctx, id);
    } catch (error) {
      throw translateUnique(error);
    }
  }

  /** `PATCH /sales/:id` — edita un borrador (RF-101). Solo estado DRAFT. */
  async update(ctx: RequestContext, id: string, dto: UpdateSaleDto): Promise<SaleDetailView> {
    await this.loadOrThrow(ctx, id);

    try {
      await this.prisma.$transaction(async (tx) => {
        const locked = await lockSaleWithinTx(tx, ctx.tenantId, id);
        if (!locked) {
          throw new NotFoundException('Venta no encontrada.');
        }
        assertDraft(locked.status);

        const current = await tx.sale.findUniqueOrThrow({
          where: { id },
          include: { items: { select: { subtotal: true } } },
        });

        const data: Prisma.SaleUpdateInput = {};
        if (dto.customerId !== undefined) {
          await this.assertCustomerUsable(tx, ctx.tenantId, dto.customerId);
          data.customer = { connect: { id: dto.customerId } };
        }
        if (dto.saleDate !== undefined) {
          data.saleDate = new Date(dto.saleDate);
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
          await tx.saleItem.deleteMany({ where: { saleId: id } });
          await this.insertItems(tx, ctx.tenantId, id, resolved);
          itemSubtotals = resolved.map((r) => r.subtotal);
        } else {
          itemSubtotals = current.items.map((i) => i.subtotal.toFixed(MONEY_SCALE));
        }

        const totals = computeSaleTotals({ itemSubtotals, discount, tax });
        assertTotalNotNegative(totals.total);

        data.discount = discount;
        data.tax = tax;
        data.subtotal = totals.subtotal;
        data.total = totals.total;

        await tx.sale.update({ where: { id }, data });
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.SALE_UPDATED,
          entityType: 'Sale',
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
   * `POST /sales/:id/complete` — aplica los efectos en UNA transaccion
   * (docs/05 890-936, docs/06 396-415, docs/07 300-345):
   *   bloquear la venta -> validar DRAFT (idempotencia, RF-171) -> cliente ->
   *   items -> productos/presentaciones activos -> resolver precios del backend
   *   -> convertir a unidad base -> recalcular totales -> descontar inventario
   *   (InventoryService, SELECT ... FOR UPDATE) -> congelar el costo en cada
   *   linea -> registrar el pago -> si CREDIT, movimiento de credito -> marcar
   *   COMPLETED -> auditoria.
   * Si algo falla, rollback total (RF-160).
   */
  async complete(
    ctx: RequestContext,
    tenantCtx: TenantContext,
    id: string,
    dto: CompleteSaleDto,
  ): Promise<SaleDetailView> {
    const preview = await this.loadOrThrow(ctx, id);
    assertDraft(preview.status);
    // Orden de AGENTS.md 6: Feature -> ... -> regla de negocio. Un tenant sin la
    // feature CREDITS no puede completar una venta al credito (docs/03 865-901).
    if (dto.method === 'CREDIT') {
      this.feature.assert(tenantCtx, CREDITS_FEATURE);
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await lockSaleWithinTx(tx, ctx.tenantId, id);
      if (!locked) {
        throw new NotFoundException('Venta no encontrada.');
      }
      // Idempotencia: una peticion concurrente que llegue aqui ve COMPLETED y sale.
      assertDraft(locked.status);

      const sale = await tx.sale.findUniqueOrThrow({
        where: { id },
        include: {
          customer: { select: { id: true, isActive: true, isGeneralCustomer: true } },
          items: { orderBy: [{ createdAt: 'asc' }] },
        },
      });

      if (!sale.customer.isActive) {
        throw new BusinessRuleException(
          ERROR_CODES.CUSTOMER_INACTIVE,
          'El cliente de la venta esta inactivo.',
        );
      }
      if (sale.items.length === 0) {
        throw new BusinessRuleException(
          ERROR_CODES.SALE_EMPTY,
          'No se puede completar una venta sin items.',
        );
      }
      if (dto.method === 'CREDIT' && sale.customer.isGeneralCustomer) {
        throw new BusinessRuleException(
          ERROR_CODES.CREDIT_REQUIRES_CUSTOMER,
          'Una venta al credito exige un cliente especifico: el cliente general no puede usarse (RF-092).',
        );
      }

      const resolved = await this.resolveItems(
        tx,
        ctx.tenantId,
        sale.items.map((i) => ({
          productId: i.productId,
          presentationId: i.presentationId ?? undefined,
          quantity: i.quantity.toString(),
        })),
      );

      for (const [index, r] of resolved.entries()) {
        // Descuento de existencia. El SELECT ... FOR UPDATE y el rechazo de
        // stock negativo (INSUFFICIENT_STOCK, 422) viven en InventoryService:
        // aqui no se reimplementan (docs/07 348-368, RF-170).
        const movement = await this.inventory.decreaseWithinTx(tx, ctx, {
          productId: r.productId,
          baseQuantity: r.baseQuantity,
          quantity: r.quantity,
          unitId: r.unitId,
          type: 'SALE',
          referenceType: SALE_REFERENCE_TYPE,
          referenceId: id,
          reason: 'Salida por venta',
        });
        // `movement.averageCost` = costo promedio vigente (una salida no lo
        // altera): se CONGELA aqui para la rentabilidad historica (docs/04 950-953).
        const unitBaseCost = new Prisma.Decimal(movement.averageCost).toFixed(COST_SCALE);
        await tx.saleItem.update({
          where: { id: sale.items[index].id },
          data: {
            unitId: r.unitId,
            productName: r.productName,
            presentationName: r.presentationName,
            conversionFactor: r.conversionFactor,
            baseQuantity: r.baseQuantity,
            unitPrice: r.unitPrice,
            subtotal: r.subtotal,
            unitBaseCost,
            unitCost: capturedUnitCost(unitBaseCost, r.conversionFactor),
          },
        });
      }

      const totals = computeSaleTotals({
        itemSubtotals: resolved.map((r) => r.subtotal),
        discount: sale.discount,
        tax: sale.tax,
      });
      assertTotalNotNegative(totals.total);

      // Pago (regla V1: un solo pago; el modelo admite varios en el futuro).
      const amount =
        dto.amount !== undefined
          ? new Prisma.Decimal(dto.amount).toFixed(MONEY_SCALE)
          : totals.total;
      if (!moneyEquals(amount, totals.total)) {
        throw new BusinessRuleException(
          ERROR_CODES.SALE_PAYMENT_MISMATCH,
          'El monto del pago debe coincidir con el total de la venta.',
          { total: totals.total, amount },
        );
      }
      await tx.salePayment.create({
        data: {
          tenantId: ctx.tenantId,
          saleId: id,
          method: dto.method,
          amount,
          reference: cleanText(dto.reference),
        },
      });

      if (dto.method === 'CREDIT') {
        await this.applyCreditSaleWithinTx(tx, ctx, sale.customer.id, id, totals.total);
      }

      await tx.sale.update({
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
        action: AUDIT_ACTIONS.SALE_COMPLETED,
        entityType: 'Sale',
        entityId: id,
        metadata: {
          customerId: sale.customer.id,
          itemCount: resolved.length,
          method: dto.method,
          subtotal: totals.subtotal,
          total: totals.total,
        },
      });
    });

    return this.get(ctx, id);
  }

  /**
   * `POST /sales/:id/cancel` — reversa una venta completada (docs/05 1420-1470,
   * RF-107). Requiere motivo. Genera una entrada compensatoria de inventario por
   * cada linea (type REVERSAL, costo nulo: no toca el promedio). Si la venta fue
   * al credito, genera un `CreditMovement(ADJUSTMENT)` que reduce el saldo. No
   * borra la venta (RN-035).
   */
  async cancel(ctx: RequestContext, id: string, dto: CancelSaleDto): Promise<SaleDetailView> {
    await this.loadOrThrow(ctx, id);
    const reason = dto.reason.trim();

    await this.prisma.$transaction(async (tx) => {
      const locked = await lockSaleWithinTx(tx, ctx.tenantId, id);
      if (!locked) {
        throw new NotFoundException('Venta no encontrada.');
      }
      // Idempotencia: solo una COMPLETED puede cancelarse; una 2a peticion ve CANCELLED.
      if (locked.status !== 'COMPLETED') {
        throw new ConflictException(
          ERROR_CODES.SALE_NOT_COMPLETED,
          'Solo se puede cancelar una venta completada.',
        );
      }

      const sale = await tx.sale.findUniqueOrThrow({
        where: { id },
        include: {
          items: { orderBy: [{ createdAt: 'asc' }] },
          payments: true,
        },
      });

      for (const item of sale.items) {
        await this.inventory.increaseWithinTx(tx, ctx, {
          productId: item.productId,
          baseQuantity: item.baseQuantity,
          quantity: item.baseQuantity,
          unitId: item.unitId,
          type: 'REVERSAL',
          unitCost: null,
          referenceType: SALE_REFERENCE_TYPE,
          referenceId: id,
          reason: 'Reverso por cancelacion de venta',
        });
      }

      const creditPaid = sale.payments
        .filter((p) => p.method === 'CREDIT')
        .reduce<Prisma.Decimal>((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
      if (creditPaid.gt(0)) {
        await this.reverseCreditSaleWithinTx(tx, ctx, sale.customerId, id, creditPaid.toFixed(MONEY_SCALE));
      }

      await tx.sale.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledByUserId: ctx.userId,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.SALE_CANCELLED,
        entityType: 'Sale',
        entityId: id,
        metadata: { reason, itemCount: sale.items.length },
      });
    });

    return this.get(ctx, id);
  }

  // --- helpers privados ------------------------------------------------

  private async loadOrThrow(ctx: RequestContext, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, status: true },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada.');
    }
    return sale;
  }

  /** El cliente debe existir en el tenant y estar activo (RN-009 analogo). */
  private async assertCustomerUsable(
    tx: Prisma.TransactionClient,
    tenantId: string,
    customerId: string,
  ): Promise<void> {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, isActive: true },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }
    if (!customer.isActive) {
      throw new BusinessRuleException(
        ERROR_CODES.CUSTOMER_INACTIVE,
        'El cliente de la venta esta inactivo.',
      );
    }
  }

  /**
   * Resuelve cada linea contra el catalogo ACTUAL del tenant y OBTIENE EL PRECIO
   * del `ProductPresentation` seleccionado (o la presentacion por defecto si no
   * se envio) — nunca del frontend (RN-015, docs/05 866-878). Usado tanto para
   * el borrador (preliminar) como para la finalizacion (autoritativo).
   */
  private async resolveItems(
    tx: Prisma.TransactionClient,
    tenantId: string,
    items: Array<Pick<SaleItemDto, 'productId' | 'quantity'> & { presentationId?: string }>,
  ): Promise<ResolvedItem[]> {
    const resolved: ResolvedItem[] = [];
    for (const item of items) {
      if (isNonPositive(item.quantity)) {
        throw new BusinessRuleException(
          ERROR_CODES.INVALID_SALE_ITEM,
          'La cantidad de cada linea debe ser mayor que cero.',
        );
      }
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId, status: 'ACTIVE' },
        select: { id: true, name: true },
      });
      if (!product) {
        throw new BusinessRuleException(
          ERROR_CODES.INVALID_SALE_ITEM,
          'Un producto de la venta no existe, esta inactivo o no pertenece al tenant.',
          { productId: item.productId },
        );
      }

      const presentation = item.presentationId
        ? await tx.productPresentation.findFirst({
            where: {
              id: item.presentationId,
              tenantId,
              productId: item.productId,
              status: 'ACTIVE',
            },
            select: { id: true, name: true, unitId: true, conversionFactor: true, salePrice: true },
          })
        : await tx.productPresentation.findFirst({
            where: { tenantId, productId: item.productId, status: 'ACTIVE', isDefault: true },
            select: { id: true, name: true, unitId: true, conversionFactor: true, salePrice: true },
          });
      if (!presentation) {
        throw new BusinessRuleException(
          ERROR_CODES.INVALID_SALE_ITEM,
          item.presentationId
            ? 'Una presentacion de la venta no existe, esta inactiva o no pertenece al producto.'
            : 'El producto no tiene una presentacion de venta activa por defecto.',
          { productId: item.productId, presentationId: item.presentationId ?? null },
        );
      }

      const conversionFactor = presentation.conversionFactor.toFixed(COST_SCALE);
      const unitPrice = presentation.salePrice.toFixed(MONEY_SCALE);
      const amounts = computeSaleItemAmounts({
        quantity: item.quantity,
        conversionFactor,
        unitPrice,
        discount: 0,
      });
      resolved.push({
        productId: product.id,
        presentationId: presentation.id,
        unitId: presentation.unitId,
        productName: product.name,
        presentationName: presentation.name,
        quantity: new Prisma.Decimal(item.quantity).toFixed(QUANTITY_SCALE),
        conversionFactor,
        baseQuantity: amounts.baseQuantity,
        unitPrice,
        discount: '0',
        subtotal: amounts.subtotal,
      });
    }
    return resolved;
  }

  private async insertItems(
    tx: Prisma.TransactionClient,
    tenantId: string,
    saleId: string,
    resolved: ResolvedItem[],
  ): Promise<void> {
    await tx.saleItem.createMany({
      data: resolved.map((r) => ({
        tenantId,
        saleId,
        productId: r.productId,
        presentationId: r.presentationId,
        unitId: r.unitId,
        productName: r.productName,
        presentationName: r.presentationName,
        quantity: r.quantity,
        conversionFactor: r.conversionFactor,
        baseQuantity: r.baseQuantity,
        unitPrice: r.unitPrice,
        discount: r.discount,
        subtotal: r.subtotal,
      })),
    });
  }

  /**
   * Efecto de credito de una venta CREDIT (Fase 7 — infra minima). Bloquea la
   * cuenta del cliente (creandola si no existe), valida el limite
   * (`saldo + total <= creditLimit`, RF-112) y registra un `CreditMovement(SALE)`
   * dentro de la transaccion de la venta (docs/04 §22, docs/05 1020-1060).
   */
  private async applyCreditSaleWithinTx(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    customerId: string,
    saleId: string,
    total: string,
  ): Promise<void> {
    const customer = await tx.customer.findFirstOrThrow({
      where: { id: customerId, tenantId: ctx.tenantId },
      select: { creditLimit: true },
    });
    const account = await lockOrCreateCreditAccountWithinTx(tx, ctx.tenantId, customerId);

    const totalDec = new Prisma.Decimal(total);
    const newBalance = account.balance.add(totalDec);
    if (newBalance.gt(customer.creditLimit)) {
      throw new BusinessRuleException(
        ERROR_CODES.CREDIT_LIMIT_EXCEEDED,
        'La venta excede el limite de credito disponible del cliente.',
        {
          creditLimit: customer.creditLimit.toFixed(MONEY_SCALE),
          currentBalance: account.balance.toFixed(MONEY_SCALE),
          saleTotal: total,
        },
      );
    }

    await tx.creditMovement.create({
      data: {
        tenantId: ctx.tenantId,
        creditAccountId: account.id,
        type: 'SALE',
        amount: totalDec.toFixed(MONEY_SCALE),
        referenceType: SALE_REFERENCE_TYPE,
        referenceId: saleId,
        reason: 'Venta al credito',
        createdByUserId: ctx.userId,
      },
    });
    await tx.creditAccount.update({
      where: { id: account.id },
      data: {
        balance: newBalance.toFixed(MONEY_SCALE),
        status: creditStatusFor(newBalance),
      },
    });
  }

  /** Reverso del efecto de credito al cancelar una venta CREDIT. */
  private async reverseCreditSaleWithinTx(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    customerId: string,
    saleId: string,
    amount: string,
  ): Promise<void> {
    const account = await lockOrCreateCreditAccountWithinTx(tx, ctx.tenantId, customerId);
    const newBalance = account.balance.sub(new Prisma.Decimal(amount));
    if (newBalance.lt(0)) {
      throw new BusinessRuleException(
        ERROR_CODES.CREDIT_CANCELLATION_CONFLICT,
        'No se puede cancelar: revertir el credito dejaria el saldo de la cuenta en negativo. Revise los abonos del cliente.',
        { currentBalance: account.balance.toFixed(MONEY_SCALE), amount },
      );
    }
    await tx.creditMovement.create({
      data: {
        tenantId: ctx.tenantId,
        creditAccountId: account.id,
        type: 'ADJUSTMENT',
        amount: new Prisma.Decimal(amount).neg().toFixed(MONEY_SCALE),
        referenceType: SALE_REFERENCE_TYPE,
        referenceId: saleId,
        reason: 'Reverso por cancelacion de venta',
        createdByUserId: ctx.userId,
      },
    });
    await tx.creditAccount.update({
      where: { id: account.id },
      data: { balance: newBalance.toFixed(MONEY_SCALE), status: creditStatusFor(newBalance) },
    });
  }
}

// --- helpers de modulo ----------------------------------------------------

function assertDraft(status: SaleStatus): void {
  if (status !== 'DRAFT') {
    throw new ConflictException(
      ERROR_CODES.SALE_NOT_DRAFT,
      'Solo una venta en borrador puede editarse o completarse.',
    );
  }
}

function assertTotalNotNegative(total: string): void {
  if (isNegative(total)) {
    throw new BusinessRuleException(
      ERROR_CODES.BUSINESS_RULE_VIOLATION,
      'El total de la venta no puede ser negativo (revise descuento e impuesto).',
    );
  }
}

/**
 * Estado de la cuenta de credito segun el saldo. En esta fase no hay abonos, asi
 * que solo se distingue PAID (saldo 0) de PENDING (saldo > 0); PARTIAL llegara
 * con el endpoint de abonos (fase de Creditos).
 */
function creditStatusFor(balance: Prisma.Decimal): CreditAccountStatus {
  return balance.lte(0) ? 'PAID' : 'PENDING';
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
 * Bloquea la fila de la venta para el resto de la transaccion (`FOR UPDATE`).
 * Serializa a los concurrentes: una segunda peticion de complete/cancel espera
 * al COMMIT de la primera y lee el estado ya cambiado (docs/07 348-368, RF-171).
 */
async function lockSaleWithinTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
): Promise<{ id: string; status: SaleStatus } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; status: SaleStatus }>>`
    SELECT id, status
      FROM sales
     WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
     FOR UPDATE`;
  return rows[0] ?? null;
}

/**
 * Cuenta de credito del cliente, bloqueada (`FOR UPDATE`) para el resto de la
 * transaccion. La crea si no existe (`INSERT ... ON CONFLICT DO NOTHING`, seguro
 * bajo concurrencia — mismo patron que `InventoryBalance`).
 */
async function lockOrCreateCreditAccountWithinTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  customerId: string,
): Promise<{ id: string; balance: Prisma.Decimal }> {
  await tx.$executeRaw`
    INSERT INTO credit_accounts (id, tenant_id, customer_id, balance, status, created_at, updated_at)
    VALUES (gen_random_uuid(), ${tenantId}::uuid, ${customerId}::uuid, 0, 'PENDING', now(), now())
    ON CONFLICT (customer_id) DO NOTHING`;
  const rows = await tx.$queryRaw<Array<{ id: string; balance: string }>>`
    SELECT id, balance
      FROM credit_accounts
     WHERE customer_id = ${customerId}::uuid AND tenant_id = ${tenantId}::uuid
     FOR UPDATE`;
  const row = rows[0];
  if (!row) {
    throw new Error(`No se pudo obtener la cuenta de credito del cliente ${customerId}`);
  }
  return { id: row.id, balance: new Prisma.Decimal(row.balance) };
}

/** Rango `saleDate`. Una fecha `to` sin hora cubre el dia completo. */
function dateRange(from?: string, to?: string): Prisma.SaleWhereInput['saleDate'] {
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
      ERROR_CODES.SALE_DOCUMENT_TAKEN,
      'Ya existe una venta con ese numero de documento en este tenant.',
    );
  }
  return error;
}
