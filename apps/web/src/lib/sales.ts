import type { Paginated } from '@ferreteria/types';

import { apiFetch } from './api';

/** Respuestas de la API de ventas (Fase 7). Cantidades y dinero llegan como cadena. */

export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
};

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  presentationId: string | null;
  presentationName: string | null;
  unitCode: string;
  quantity: string;
  conversionFactor: string;
  baseQuantity: string;
  unitPrice: string;
  discount: string;
  subtotal: string;
  unitCost: string | null;
  unitBaseCost: string | null;
}

export interface SalePayment {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string | null;
  createdAt: string;
}

export interface SaleListItem {
  id: string;
  status: SaleStatus;
  saleDate: string;
  documentNumber: string | null;
  customerId: string;
  customerName: string;
  total: string;
  itemCount: number;
  createdAt: string;
}

export interface SaleDetail {
  id: string;
  status: SaleStatus;
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
  items: SaleItem[];
  payments: SalePayment[];
}

export interface SaleItemInput {
  productId: string;
  presentationId?: string;
  quantity: string;
}

export interface SaleListParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  customerId?: string;
  status?: SaleStatus | 'all';
  search?: string;
}

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: 'Borrador',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      q.set(key, String(value));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

const jsonBody = (data: unknown): RequestInit => ({ body: JSON.stringify(data) });

export const salesApi = {
  list: (params: SaleListParams = {}): Promise<Paginated<SaleListItem>> =>
    apiFetch(`/sales${query({ ...params })}`),

  get: (id: string): Promise<SaleDetail> => apiFetch(`/sales/${id}`),

  create: (data: Record<string, unknown>): Promise<SaleDetail> =>
    apiFetch('/sales', { method: 'POST', ...jsonBody(data) }),

  update: (id: string, data: Record<string, unknown>): Promise<SaleDetail> =>
    apiFetch(`/sales/${id}`, { method: 'PATCH', ...jsonBody(data) }),

  complete: (id: string, data: Record<string, unknown>): Promise<SaleDetail> =>
    apiFetch(`/sales/${id}/complete`, { method: 'POST', ...jsonBody(data) }),

  cancel: (id: string, reason: string): Promise<SaleDetail> =>
    apiFetch(`/sales/${id}/cancel`, { method: 'POST', ...jsonBody({ reason }) }),
};
