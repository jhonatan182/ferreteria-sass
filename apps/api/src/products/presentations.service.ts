import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@ferreteria/types';

import { AUDIT_ACTIONS } from '../audit/audit-actions.js';
import { AuditService } from '../audit/audit.service.js';
import {
  BusinessRuleException,
  ConflictException,
  ERROR_CODES,
  NotFoundException,
} from '../common/errors.js';
import { isUniqueViolation } from '../common/prisma-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangePriceDto } from './dto/change-price.dto.js';
import type { CreatePresentationDto } from './dto/create-presentation.dto.js';
import type { UpdatePresentationDto } from './dto/update-presentation.dto.js';
import type { PresentationView } from './products.views.js';

/**
 * Casos de uso de ProductPresentation (docs/04 575-613, docs/05 322-394).
 *
 * Reglas que valida el backend (AGENTS.md 4): pertenencia al tenant y al
 * producto, unidad valida, `conversionFactor > 0`, precio >= 0, y una sola
 * presentacion principal por producto (RN-016; ademas indice unico parcial).
 */
@Injectable()
export class PresentationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: RequestContext, productId: string): Promise<PresentationView[]> {
    await this.loadProductOrThrow(ctx, productId);
    const rows = await this.prisma.productPresentation.findMany({
      where: { tenantId: ctx.tenantId, productId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { unit: { select: { code: true } } },
    });
    return rows.map(toPresentationView);
  }

  async create(
    ctx: RequestContext,
    productId: string,
    dto: CreatePresentationDto,
  ): Promise<PresentationView> {
    await this.loadProductOrThrow(ctx, productId);
    assertFactorAndPrice(dto.conversionFactor, dto.salePrice);

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        await this.assertUnit(tx, ctx.tenantId, dto.unitId);
        const existing = await tx.productPresentation.count({
          where: { tenantId: ctx.tenantId, productId },
        });
        const makeDefault = existing === 0 || dto.isDefault === true;
        if (makeDefault) {
          await tx.productPresentation.updateMany({
            where: { tenantId: ctx.tenantId, productId, isDefault: true },
            data: { isDefault: false },
          });
        }
        const created = await tx.productPresentation.create({
          data: {
            tenantId: ctx.tenantId,
            productId,
            unitId: dto.unitId,
            name: dto.name.trim(),
            conversionFactor: dto.conversionFactor,
            salePrice: dto.salePrice,
            isDefault: makeDefault,
          },
        });
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.PRESENTATION_CREATED,
          entityType: 'ProductPresentation',
          entityId: created.id,
          metadata: { productId, name: created.name, salePrice: dto.salePrice, isDefault: makeDefault },
        });
        return created.id;
      });
      return this.viewById(ctx, id);
    } catch (error) {
      throw translatePresentationUnique(error);
    }
  }

  async update(
    ctx: RequestContext,
    productId: string,
    presentationId: string,
    dto: UpdatePresentationDto,
  ): Promise<PresentationView> {
    await this.loadPresentationOrThrow(ctx, productId, presentationId);
    if (dto.conversionFactor !== undefined && Number(dto.conversionFactor) <= 0) {
      throw new BusinessRuleException(
        ERROR_CODES.INVALID_PRESENTATION,
        'El factor de conversion debe ser mayor que cero.',
      );
    }
    const data: Prisma.ProductPresentationUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.conversionFactor !== undefined) {
      data.conversionFactor = dto.conversionFactor;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.unitId !== undefined) {
          await this.assertUnit(tx, ctx.tenantId, dto.unitId);
          data.unit = { connect: { id: dto.unitId } };
        }
        await tx.productPresentation.update({ where: { id: presentationId }, data });
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.PRESENTATION_UPDATED,
          entityType: 'ProductPresentation',
          entityId: presentationId,
          metadata: { fields: Object.keys(dto) },
        });
      });
    } catch (error) {
      throw translatePresentationUnique(error);
    }
    return this.viewById(ctx, presentationId);
  }

  async changePrice(
    ctx: RequestContext,
    productId: string,
    presentationId: string,
    dto: ChangePriceDto,
  ): Promise<PresentationView> {
    if (Number(dto.salePrice) < 0) {
      throw new BusinessRuleException(
        ERROR_CODES.INVALID_PRESENTATION,
        'El precio de venta no puede ser negativo.',
      );
    }
    const presentation = await this.loadPresentationOrThrow(ctx, productId, presentationId);
    const previousPrice = presentation.salePrice.toString();

    await this.prisma.$transaction(async (tx) => {
      await tx.productPresentation.update({
        where: { id: presentationId },
        data: { salePrice: dto.salePrice },
      });
      await this.audit.record(tx, ctx, {
        action: AUDIT_ACTIONS.PRODUCT_PRICE_CHANGED,
        entityType: 'ProductPresentation',
        entityId: presentationId,
        metadata: {
          productId,
          previousPrice,
          newPrice: dto.salePrice,
          reason: dto.reason ?? null,
        },
      });
    });
    return this.viewById(ctx, presentationId);
  }

  async setDefault(
    ctx: RequestContext,
    productId: string,
    presentationId: string,
  ): Promise<PresentationView> {
    const presentation = await this.loadPresentationOrThrow(ctx, productId, presentationId);
    if (presentation.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        ERROR_CODES.INVALID_PRESENTATION,
        'Una presentacion inactiva no puede ser la principal.',
      );
    }
    if (!presentation.isDefault) {
      await this.prisma.$transaction(async (tx) => {
        await tx.productPresentation.updateMany({
          where: { tenantId: ctx.tenantId, productId, isDefault: true },
          data: { isDefault: false },
        });
        await tx.productPresentation.update({
          where: { id: presentationId },
          data: { isDefault: true },
        });
        await this.audit.record(tx, ctx, {
          action: AUDIT_ACTIONS.PRESENTATION_DEFAULT_CHANGED,
          entityType: 'ProductPresentation',
          entityId: presentationId,
          metadata: { productId },
        });
      });
    }
    return this.viewById(ctx, presentationId);
  }

  async setStatus(
    ctx: RequestContext,
    productId: string,
    presentationId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<PresentationView> {
    const presentation = await this.loadPresentationOrThrow(ctx, productId, presentationId);
    if (presentation.status === status) {
      return this.viewById(ctx, presentationId);
    }
    if (status === 'INACTIVE' && presentation.isDefault) {
      throw new BusinessRuleException(
        ERROR_CODES.INVALID_PRESENTATION,
        'Designa otra presentacion como principal antes de desactivar esta.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.productPresentation.update({ where: { id: presentationId }, data: { status } });
      await this.audit.record(tx, ctx, {
        action:
          status === 'ACTIVE'
            ? AUDIT_ACTIONS.PRESENTATION_ACTIVATED
            : AUDIT_ACTIONS.PRESENTATION_DEACTIVATED,
        entityType: 'ProductPresentation',
        entityId: presentationId,
      });
    });
    return this.viewById(ctx, presentationId);
  }

  // --- helpers privados --------------------------------------------------

  private async loadProductOrThrow(ctx: RequestContext, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return product;
  }

  private async loadPresentationOrThrow(
    ctx: RequestContext,
    productId: string,
    presentationId: string,
  ) {
    const presentation = await this.prisma.productPresentation.findFirst({
      where: { id: presentationId, productId, tenantId: ctx.tenantId },
    });
    if (!presentation) {
      throw new NotFoundException('Presentacion no encontrada.');
    }
    return presentation;
  }

  private async assertUnit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    unitId: string,
  ): Promise<void> {
    const unit = await tx.unit.findFirst({
      where: { id: unitId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!unit) {
      throw new BusinessRuleException(
        ERROR_CODES.INVALID_PRESENTATION,
        'La unidad no existe, no pertenece al tenant o esta inactiva.',
      );
    }
  }

  private async viewById(ctx: RequestContext, presentationId: string): Promise<PresentationView> {
    const row = await this.prisma.productPresentation.findFirst({
      where: { id: presentationId, tenantId: ctx.tenantId },
      include: { unit: { select: { code: true } } },
    });
    if (!row) {
      throw new NotFoundException('Presentacion no encontrada.');
    }
    return toPresentationView(row);
  }
}

function assertFactorAndPrice(conversionFactor: string, salePrice: string): void {
  if (Number(conversionFactor) <= 0) {
    throw new BusinessRuleException(
      ERROR_CODES.INVALID_PRESENTATION,
      'El factor de conversion debe ser mayor que cero.',
    );
  }
  if (Number(salePrice) < 0) {
    throw new BusinessRuleException(
      ERROR_CODES.INVALID_PRESENTATION,
      'El precio de venta no puede ser negativo.',
    );
  }
}

function toPresentationView(row: {
  id: string;
  name: string;
  unitId: string;
  unit: { code: string };
  conversionFactor: Prisma.Decimal;
  salePrice: Prisma.Decimal;
  isDefault: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}): PresentationView {
  return {
    id: row.id,
    name: row.name,
    unitId: row.unitId,
    unitCode: row.unit.code,
    conversionFactor: row.conversionFactor.toString(),
    salePrice: row.salePrice.toString(),
    isDefault: row.isDefault,
    status: row.status,
  };
}

function translatePresentationUnique(error: unknown): unknown {
  if (isUniqueViolation(error)) {
    return new ConflictException(
      ERROR_CODES.INVALID_PRESENTATION,
      'Ya existe una presentacion con ese nombre en el producto.',
    );
  }
  return error;
}
