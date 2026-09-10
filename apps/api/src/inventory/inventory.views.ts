/**
 * Vistas de respuesta de la API de inventario. Hechas a mano (precedente de
 * `products.views.ts`): no se exponen entidades Prisma crudas. Cantidades y
 * dinero salen como CADENA (AGENTS.md 11-12).
 */

export interface InventoryBalanceListItemView {
  productId: string;
  internalCode: string;
  barcode: string | null;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  baseUnitCode: string;
  /** Existencia actual en unidad base. */
  quantity: string;
  averageCost: string;
  /** quantity * averageCost (valor aproximado de inventario, RF-132). */
  inventoryValue: string;
}

export interface ProductInventoryView {
  productId: string;
  internalCode: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  baseUnitId: string;
  baseUnitCode: string;
  quantity: string;
  averageCost: string;
  inventoryValue: string;
  updatedAt: string | null;
}

export interface KardexEntryView {
  id: string;
  date: string;
  type: string;
  /** Entrada en unidad base (0 si es salida). */
  entrada: string;
  /** Salida en unidad base (0 si es entrada). */
  salida: string;
  /** Saldo en unidad base tras el movimiento. */
  saldo: string;
  unitCode: string;
  unitCost: string | null;
  userName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
}

export interface AdjustmentResultView {
  adjustmentId: string;
  movementId: string;
  productId: string;
  internalCode: string;
  name: string;
  direction: 'IN' | 'OUT';
  /** Magnitud del ajuste en unidad base. */
  quantity: string;
  previousQuantity: string;
  resultingQuantity: string;
  averageCost: string;
}
