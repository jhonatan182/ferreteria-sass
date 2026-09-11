/**
 * Vistas de respuesta de la API de ventas. Hechas a mano: no se exponen
 * entidades Prisma crudas. Cantidades y dinero salen como CADENA (AGENTS.md 11-12).
 */

export type SaleStatusView = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethodView = 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';

export interface SaleItemView {
  id: string;
  productId: string;
  productName: string;
  presentationId: string | null;
  presentationName: string | null;
  unitCode: string;
  /** Cantidad capturada en la unidad de la presentacion (o base). */
  quantity: string;
  conversionFactor: string;
  /** Cantidad en unidad base (quantity * conversionFactor). */
  baseQuantity: string;
  /** Precio de una unidad capturada, resuelto por el backend. */
  unitPrice: string;
  discount: string;
  subtotal: string;
  /** Costo congelado al completar (rentabilidad historica). Nulo si DRAFT. */
  unitCost: string | null;
  unitBaseCost: string | null;
}

export interface SalePaymentView {
  id: string;
  method: PaymentMethodView;
  amount: string;
  reference: string | null;
  createdAt: string;
}

export interface SaleListItemView {
  id: string;
  status: SaleStatusView;
  saleDate: string;
  documentNumber: string | null;
  customerId: string;
  customerName: string;
  total: string;
  itemCount: number;
  createdAt: string;
}

export interface SaleDetailView {
  id: string;
  status: SaleStatusView;
  saleDate: string;
  documentNumber: string | null;
  customerId: string;
  customerName: string;
  customerIsGeneral: boolean;
  customerIsActive: boolean;
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
  items: SaleItemView[];
  payments: SalePaymentView[];
}
