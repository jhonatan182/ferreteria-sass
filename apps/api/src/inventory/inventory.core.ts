/**
 * Reglas puras del dominio de inventario (capa "Domain services" de docs/07 93-110).
 *
 * Sin NestJS: funciones testeables y REUTILIZABLES por:
 *   - `InventoryService` (endpoints de ajuste / costo);
 *   - el seed (`prisma/seed.ts`, existencia de apertura demo);
 *   - las futuras fases de Compras y Ventas, que abriran su propia transaccion
 *     grande y llamaran a `recordMovementWithinTx` en lugar de reimplementar la
 *     logica de stock (docs/05 1912-1942, docs/07 308-345).
 *
 * Invariantes que garantiza `recordMovementWithinTx`:
 *   - el balance se bloquea con `SELECT ... FOR UPDATE` DENTRO de la transaccion,
 *     asi dos operaciones concurrentes no consumen la misma existencia
 *     (AGENTS.md 264-276, docs/07 348-368);
 *   - `resultingQuantity` nunca queda < 0 (RN-022, RF-064): si lo haria, lanza
 *     `INSUFFICIENT_STOCK` y la transaccion revierte;
 *   - cada cambio de existencia produce un `InventoryMovement` con el saldo
 *     previo y posterior (RN-019/RN-021/RN-025).
 *
 * El dinero y las cantidades se manejan con `Prisma.Decimal`, nunca `number`
 * (AGENTS.md 11-12). Escala: cantidades 4 decimales, costos 6.
 */
import { BusinessRuleException, ERROR_CODES } from '../common/errors.js';
import { Prisma } from '../generated/prisma/client.js';
import type { InventoryMovementType } from '../generated/prisma/client.js';

/** Decimales de cantidad en unidad base. */
export const QUANTITY_SCALE = 4;
/** Decimales de costo (promedio ponderado / costo unitario). */
export const COST_SCALE = 6;

const ZERO = new Prisma.Decimal(0);

export function toDecimal(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * Convierte una cantidad expresada en una presentacion a la unidad base
 * (RN-013 / RN-014): `baseQuantity = quantity * conversionFactor`.
 *
 * Utilidad lista para Compras y Ventas; el inventario SIEMPRE se almacena en la
 * unidad base del producto (docs/04 610-613).
 */
export function toBaseQuantity(
  quantity: Prisma.Decimal | string | number,
  conversionFactor: Prisma.Decimal | string | number,
): string {
  return toDecimal(quantity).mul(toDecimal(conversionFactor)).toFixed(QUANTITY_SCALE);
}

/**
 * Costo promedio ponderado tras una entrada (docs/07 383-404):
 *
 *   nuevoCosto = (stockAnterior * costoAnterior + cantidadEntrada * costoEntrada)
 *               / (stockAnterior + cantidadEntrada)
 *
 * Si el stock anterior es <= 0, el nuevo costo es el costo de entrada.
 * Se calcula SIEMPRE dentro de la misma transaccion que la entrada.
 */
export function computeWeightedAverage(
  prevQty: Prisma.Decimal | string | number,
  prevAvg: Prisma.Decimal | string | number,
  inQty: Prisma.Decimal | string | number,
  inCost: Prisma.Decimal | string | number,
): string {
  const pQty = toDecimal(prevQty);
  const iQty = toDecimal(inQty);
  const iCost = toDecimal(inCost);
  if (pQty.lte(0)) {
    return iCost.toFixed(COST_SCALE);
  }
  const numerator = pQty.mul(toDecimal(prevAvg)).add(iQty.mul(iCost));
  return numerator.div(pQty.add(iQty)).toFixed(COST_SCALE);
}

export interface LockedBalance {
  id: string;
  quantity: Prisma.Decimal;
  averageCost: Prisma.Decimal;
}

/**
 * Crea la fila de balance si el tenant/producto aun no tiene una.
 *
 * `INSERT ... ON CONFLICT DO NOTHING`: idempotente y seguro bajo concurrencia
 * (mismo patron que `TenantProductSequence`, docs/04 615-631). Cubre los
 * productos creados en la Fase 4 (antes de que existiera inventario) y el seed.
 * `ProductsService.create` ademas la crea de forma anticipada (docs/05 278-284).
 */
export async function ensureBalanceWithinTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string,
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO inventory_balances (id, tenant_id, product_id, quantity, average_cost, created_at, updated_at)
    VALUES (gen_random_uuid(), ${tenantId}::uuid, ${productId}::uuid, 0, 0, now(), now())
    ON CONFLICT (tenant_id, product_id) DO NOTHING`;
}

/**
 * Bloquea la fila de balance para el resto de la transaccion (`FOR UPDATE`).
 * Debe llamarse tras `ensureBalanceWithinTx`. Serializa a los concurrentes:
 * el segundo `SELECT ... FOR UPDATE` espera al COMMIT del primero y lee el
 * saldo ya actualizado (docs/07 348-368).
 */
export async function lockBalanceWithinTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string,
): Promise<LockedBalance> {
  const rows = await tx.$queryRaw<Array<{ id: string; quantity: string; average_cost: string }>>`
    SELECT id, quantity, average_cost
      FROM inventory_balances
     WHERE tenant_id = ${tenantId}::uuid AND product_id = ${productId}::uuid
     FOR UPDATE`;
  const row = rows[0];
  if (!row) {
    throw new Error(
      `No hay balance de inventario para el producto ${productId} del tenant ${tenantId}`,
    );
  }
  return {
    id: row.id,
    quantity: new Prisma.Decimal(row.quantity),
    averageCost: new Prisma.Decimal(row.average_cost),
  };
}

export interface RecordMovementParams {
  tenantId: string;
  productId: string;
  type: InventoryMovementType;
  /** Cantidad capturada en su unidad (magnitud, sin signo). */
  quantity: Prisma.Decimal | string | number;
  /** Unidad en que se capturo (en ajustes: la unidad base del producto). */
  unitId: string;
  /**
   * Efecto sobre el inventario en unidad base, CON SIGNO:
   * positivo = entra, negativo = sale.
   */
  baseQuantityDelta: Prisma.Decimal | string | number;
  /**
   * Solo entradas con costo propio (Compras): recalcula el promedio ponderado.
   * Los ajustes NO lo envian: el ajuste corrige cantidad, no valoracion
   * (docs/04 seccion 46). Se guarda el `averageCost` vigente como snapshot.
   */
  unitCost?: Prisma.Decimal | string | number | null;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  userId?: string | null;
}

export interface MovementResult {
  id: string;
  /** Cadenas decimales normalizadas (sin ceros de relleno), estilo de la casa. */
  previousQuantity: string;
  resultingQuantity: string;
  /** `averageCost` del balance tras el movimiento. */
  averageCost: string;
}

/**
 * Aplica un movimiento de inventario dentro de una transaccion ya abierta.
 *
 * Pasos (docs/07 360-368):
 *   1. asegurar la fila de balance;
 *   2. bloquearla (`FOR UPDATE`);
 *   3. calcular el saldo resultante;
 *   4. rechazar si quedaria negativo (`INSUFFICIENT_STOCK`);
 *   5. recalcular el costo promedio si la entrada trae costo;
 *   6. actualizar el balance;
 *   7. registrar el `InventoryMovement` (append-only) con snapshot previo/posterior.
 */
export async function recordMovementWithinTx(
  tx: Prisma.TransactionClient,
  params: RecordMovementParams,
): Promise<MovementResult> {
  await ensureBalanceWithinTx(tx, params.tenantId, params.productId);
  const balance = await lockBalanceWithinTx(tx, params.tenantId, params.productId);

  const delta = toDecimal(params.baseQuantityDelta);
  const previousQuantity = balance.quantity;
  const resultingQuantity = previousQuantity.add(delta);

  if (resultingQuantity.lt(0)) {
    throw new BusinessRuleException(
      ERROR_CODES.INSUFFICIENT_STOCK,
      'No hay existencia suficiente para completar la operacion.',
      {
        productId: params.productId,
        available: previousQuantity.toFixed(QUANTITY_SCALE),
        requested: delta.abs().toFixed(QUANTITY_SCALE),
      },
    );
  }

  const unitCost =
    params.unitCost === null || params.unitCost === undefined ? null : toDecimal(params.unitCost);
  let nextAverage = balance.averageCost;
  if (unitCost !== null && delta.gt(0)) {
    nextAverage = new Prisma.Decimal(
      computeWeightedAverage(previousQuantity, balance.averageCost, delta, unitCost),
    );
  }
  const snapshotCost = unitCost ?? balance.averageCost;

  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: {
      quantity: resultingQuantity.toFixed(QUANTITY_SCALE),
      averageCost: nextAverage.toFixed(COST_SCALE),
    },
  });

  const movement = await tx.inventoryMovement.create({
    data: {
      tenantId: params.tenantId,
      productId: params.productId,
      type: params.type,
      quantity: toDecimal(params.quantity).abs().toFixed(QUANTITY_SCALE),
      unitId: params.unitId,
      baseQuantity: delta.toFixed(QUANTITY_SCALE),
      previousQuantity: previousQuantity.toFixed(QUANTITY_SCALE),
      resultingQuantity: resultingQuantity.toFixed(QUANTITY_SCALE),
      unitCost: snapshotCost.toFixed(COST_SCALE),
      reason: params.reason ?? null,
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      userId: params.userId ?? null,
    },
    select: { id: true },
  });

  return {
    id: movement.id,
    previousQuantity: previousQuantity.toString(),
    resultingQuantity: resultingQuantity.toString(),
    averageCost: new Prisma.Decimal(nextAverage.toFixed(COST_SCALE)).toString(),
  };
}

/** entrada / salida del kardex a partir del `baseQuantity` con signo. */
export function splitInOut(baseQuantity: Prisma.Decimal | string | number): {
  entrada: string;
  salida: string;
} {
  const v = toDecimal(baseQuantity);
  return v.gte(0)
    ? { entrada: v.toString(), salida: ZERO.toString() }
    : { entrada: ZERO.toString(), salida: v.abs().toString() };
}
