/**
 * Vistas de respuesta de la API de compras. Hechas a mano: no se exponen
 * entidades Prisma crudas. Cantidades y dinero salen como CADENA (AGENTS.md 11-12).
 */

export type PurchaseStatusView = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface PurchaseItemView {
  id: string;
  productId: string;
  productInternalCode: string;
  productName: string;
  presentationId: string | null;
  presentationName: string | null;
  unitCode: string;
  /** Cantidad capturada en la unidad de la presentacion (o base). */
  quantity: string;
  conversionFactor: string;
  /** Cantidad en unidad base (quantity * conversionFactor). */
  baseQuantity: string;
  /** Costo de una unidad capturada. */
  unitCost: string;
  /** Costo por unidad base (unitCost / conversionFactor). */
  unitBaseCost: string;
  subtotal: string;
}

export interface PurchaseListItemView {
  id: string;
  status: PurchaseStatusView;
  purchaseDate: string;
  documentNumber: string | null;
  supplierId: string;
  supplierName: string;
  total: string;
  itemCount: number;
  createdAt: string;
}

export interface PurchaseDetailView {
  id: string;
  status: PurchaseStatusView;
  purchaseDate: string;
  documentNumber: string | null;
  supplierId: string;
  supplierName: string;
  supplierIsActive: boolean;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  notes: string | null;
  createdByUserId: string;
  createdByName: string | null;
  createdAt: string;
  completedByUserId: string | null;
  completedByName: string | null;
  completedAt: string | null;
  cancelledByUserId: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  updatedAt: string;
  items: PurchaseItemView[];
}
