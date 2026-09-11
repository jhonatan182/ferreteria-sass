/**
 * Reglas puras del dominio de ventas (capa "Domain services" de docs/07 93-110).
 *
 * Sin NestJS: funciones testeables. El backend es la autoridad de los totales y
 * del precio (AGENTS.md 4, 18): nunca se usan `subtotal`, `total`, `baseQuantity`
 * ni `unitPrice` enviados por el frontend — el precio se resuelve del
 * `ProductPresentation` y los totales se recalculan aqui.
 *
 * Todo con `Prisma.Decimal`, nunca `number` (AGENTS.md 11-12). Escala coherente
 * con las fases previas (docs/04 seccion 45 D5 / 46 D2 / 47 D6):
 *   - cantidades / dinero de linea y cabecera: 4 decimales
 *   - costo por unidad base (viene de `InventoryBalance.averageCost`): 6 decimales
 */
import { Prisma } from '../generated/prisma/client.js';
import { toDecimal } from '../inventory/inventory.core.js';

export const MONEY_SCALE = 4;
export const QUANTITY_SCALE = 4;
export const COST_SCALE = 6;

const ZERO = new Prisma.Decimal(0);

export interface SaleItemAmountsInput {
  /** Cantidad capturada en la unidad de la presentacion (o la unidad base). */
  quantity: Prisma.Decimal | string | number;
  /** Factor hacia la unidad base (1 si no hay presentacion). */
  conversionFactor: Prisma.Decimal | string | number;
  /** Precio de UNA unidad capturada, resuelto del `ProductPresentation`. */
  unitPrice: Prisma.Decimal | string | number;
  /** Descuento de linea. En V1 siempre 0 (docs/04 seccion 48): no hay permiso de descuento. */
  discount?: Prisma.Decimal | string | number;
}

export interface SaleItemAmounts {
  /** quantity * conversionFactor — lo que sale del inventario (unidad base). */
  baseQuantity: string;
  /** quantity * unitPrice - discount — importe de la linea. */
  subtotal: string;
}

/**
 * Convierte una linea de venta a la magnitud de inventario y al importe de linea
 * (RN-013 / RN-014, docs/04 823-850, docs/05 866-878).
 *
 * Ejemplo (prompt Fase 7): Cemento en libras, presentacion "Bolsa 50 lb"
 * (conversionFactor = 50), venta de 3 bolsas -> baseQuantity = 150 lb.
 */
export function computeSaleItemAmounts(input: SaleItemAmountsInput): SaleItemAmounts {
  const quantity = toDecimal(input.quantity);
  const factor = toDecimal(input.conversionFactor);
  const unitPrice = toDecimal(input.unitPrice);
  const discount = toDecimal(input.discount ?? 0);
  return {
    baseQuantity: quantity.mul(factor).toFixed(QUANTITY_SCALE),
    subtotal: quantity.mul(unitPrice).sub(discount).toFixed(MONEY_SCALE),
  };
}

/**
 * Costo de UNA unidad capturada a partir del costo por unidad base
 * (`InventoryBalance.averageCost`) y el factor de la presentacion:
 * `unitCost = unitBaseCost * conversionFactor`. Se congela en `SaleItem` al
 * completar para la rentabilidad historica (docs/04 950-953).
 */
export function capturedUnitCost(
  unitBaseCost: Prisma.Decimal | string | number,
  conversionFactor: Prisma.Decimal | string | number,
): string {
  return toDecimal(unitBaseCost).mul(toDecimal(conversionFactor)).toFixed(COST_SCALE);
}

export interface SaleTotalsInput {
  itemSubtotals: Array<Prisma.Decimal | string | number>;
  /** Descuento de cabecera (entra del cliente). */
  discount: Prisma.Decimal | string | number;
  /** Impuesto de cabecera (entra del cliente; no hay tasa fija — docs/04 1393-1412). */
  tax: Prisma.Decimal | string | number;
}

export interface SaleTotals {
  subtotal: string;
  total: string;
}

/**
 * Totales de la venta a partir de los importes de linea (docs/05 890-936 paso
 * "recalcular subtotal/descuento/impuesto/total").
 *
 *   subtotal = suma de subtotales de linea
 *   total    = subtotal - discount + tax
 */
export function computeSaleTotals(input: SaleTotalsInput): SaleTotals {
  const subtotal = input.itemSubtotals.reduce<Prisma.Decimal>(
    (acc, value) => acc.add(toDecimal(value)),
    ZERO,
  );
  const total = subtotal.sub(toDecimal(input.discount)).add(toDecimal(input.tax));
  return { subtotal: subtotal.toFixed(MONEY_SCALE), total: total.toFixed(MONEY_SCALE) };
}

/** `true` si la cantidad es <= 0 (una linea de venta debe restar existencia). */
export function isNonPositive(value: Prisma.Decimal | string | number): boolean {
  return toDecimal(value).lte(0);
}

/** `true` si el valor es negativo (descuento/impuesto/total no pueden serlo). */
export function isNegative(value: Prisma.Decimal | string | number): boolean {
  return toDecimal(value).lt(0);
}

/** Compara dos importes de dinero con la escala del sistema. */
export function moneyEquals(
  a: Prisma.Decimal | string | number,
  b: Prisma.Decimal | string | number,
): boolean {
  return toDecimal(a).toFixed(MONEY_SCALE) === toDecimal(b).toFixed(MONEY_SCALE);
}
