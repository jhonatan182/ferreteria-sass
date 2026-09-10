/**
 * Reglas puras del dominio de compras (capa "Domain services" de docs/07 93-110).
 *
 * Sin NestJS: funciones testeables. El backend es la autoridad de los totales
 * (AGENTS.md 18, RF-082): nunca se usan `subtotal`, `total`, `baseQuantity`,
 * `conversionFactor` ni el costo base enviados por el frontend — se recalculan
 * aqui a partir de los datos persistidos.
 *
 * Todo con `Prisma.Decimal`, nunca `number` (AGENTS.md 11-12). Escala:
 *   - cantidades / dinero de linea y cabecera: 4 decimales
 *   - costo por unidad base (alimenta el promedio ponderado): 6 decimales
 *     (coherente con `InventoryBalance.averageCost`, docs/04 seccion 46 D2)
 */
import { Prisma } from '../generated/prisma/client.js';
import { toDecimal } from '../inventory/inventory.core.js';

export const MONEY_SCALE = 4;
export const QUANTITY_SCALE = 4;
export const COST_SCALE = 6;

const ZERO = new Prisma.Decimal(0);

export interface ItemAmountsInput {
  /** Cantidad capturada en la unidad de la presentacion (o la unidad base). */
  quantity: Prisma.Decimal | string | number;
  /** Factor hacia la unidad base (1 si no hay presentacion). */
  conversionFactor: Prisma.Decimal | string | number;
  /** Costo de UNA unidad capturada (por presentacion o por unidad base). */
  unitCost: Prisma.Decimal | string | number;
}

export interface ItemAmounts {
  /** quantity * conversionFactor — lo que entra al inventario (unidad base). */
  baseQuantity: string;
  /**
   * unitCost / conversionFactor — costo por unidad base.
   * Ejemplo (docs/04 830-850): bolsa 50 lb = L 250  ->  250 / 50 = L 5 / lb.
   */
  unitBaseCost: string;
  /** quantity * unitCost — importe de la linea. */
  subtotal: string;
}

/**
 * Convierte una linea de compra a magnitudes de inventario y al importe de linea
 * (RN-013 / RN-014, docs/04 823-850).
 */
export function computeItemAmounts(input: ItemAmountsInput): ItemAmounts {
  const quantity = toDecimal(input.quantity);
  const factor = toDecimal(input.conversionFactor);
  const unitCost = toDecimal(input.unitCost);
  return {
    baseQuantity: quantity.mul(factor).toFixed(QUANTITY_SCALE),
    unitBaseCost: factor.lte(0)
      ? unitCost.toFixed(COST_SCALE)
      : unitCost.div(factor).toFixed(COST_SCALE),
    subtotal: quantity.mul(unitCost).toFixed(MONEY_SCALE),
  };
}

export interface PurchaseTotalsInput {
  itemSubtotals: Array<Prisma.Decimal | string | number>;
  /** Descuento de cabecera (entra del cliente). */
  discount: Prisma.Decimal | string | number;
  /** Impuesto de cabecera (entra del cliente; no hay tasa fija — docs/04 1393-1412). */
  tax: Prisma.Decimal | string | number;
}

export interface PurchaseTotals {
  subtotal: string;
  total: string;
}

/**
 * Totales de la compra a partir de los importes de linea PERSISTIDOS
 * (docs/05 512-556 paso "recalcular subtotales y total en backend").
 *
 *   subtotal = suma de subtotales de linea
 *   total    = subtotal - discount + tax
 */
export function computePurchaseTotals(input: PurchaseTotalsInput): PurchaseTotals {
  const subtotal = input.itemSubtotals.reduce<Prisma.Decimal>(
    (acc, value) => acc.add(toDecimal(value)),
    ZERO,
  );
  const total = subtotal.sub(toDecimal(input.discount)).add(toDecimal(input.tax));
  return { subtotal: subtotal.toFixed(MONEY_SCALE), total: total.toFixed(MONEY_SCALE) };
}

/** `true` si la cantidad es <= 0 (una linea de compra debe sumar existencia). */
export function isNonPositive(value: Prisma.Decimal | string | number): boolean {
  return toDecimal(value).lte(0);
}

/** `true` si el valor es negativo (descuento/impuesto/total no pueden serlo). */
export function isNegative(value: Prisma.Decimal | string | number): boolean {
  return toDecimal(value).lt(0);
}
