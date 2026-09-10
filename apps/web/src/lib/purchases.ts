import type { Paginated } from '@ferreteria/types';

import { apiFetch } from './api';

/** Respuestas de la API de compras (Fase 6). Cantidades y dinero llegan como cadena. */

export type PurchaseStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface PurchaseItem {
  id: string;
  productId: string;
  productInternalCode: string;
  productName: string;
  presentationId: string | null;
  presentationName: string | null;
  unitCode: string;
  quantity: string;
  conversionFactor: string;
  baseQuantity: string;
  unitCost: string;
  unitBaseCost: string;
  subtotal: string;
}

export interface PurchaseListItem {
  id: string;
  status: PurchaseStatus;
  purchaseDate: string;
  documentNumber: string | null;
  supplierId: string;
  supplierName: string;
  total: string;
  itemCount: number;
  createdAt: string;
}

export interface PurchaseDetail {
  id: string;
  status: PurchaseStatus;
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
  items: PurchaseItem[];
}

export interface PurchaseItemInput {
  productId: string;
  presentationId?: string;
  quantity: string;
  unitCost: string;
}

export interface PurchaseListParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  supplierId?: string;
  status?: PurchaseStatus | 'all';
  search?: string;
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
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

export const purchasesApi = {
  list: (params: PurchaseListParams = {}): Promise<Paginated<PurchaseListItem>> =>
    apiFetch(`/purchases${query({ ...params })}`),

  get: (id: string): Promise<PurchaseDetail> => apiFetch(`/purchases/${id}`),

  create: (data: Record<string, unknown>): Promise<PurchaseDetail> =>
    apiFetch('/purchases', { method: 'POST', ...jsonBody(data) }),

  update: (id: string, data: Record<string, unknown>): Promise<PurchaseDetail> =>
    apiFetch(`/purchases/${id}`, { method: 'PATCH', ...jsonBody(data) }),

  complete: (id: string): Promise<PurchaseDetail> =>
    apiFetch(`/purchases/${id}/complete`, { method: 'POST' }),

  cancel: (id: string, reason: string): Promise<PurchaseDetail> =>
    apiFetch(`/purchases/${id}/cancel`, { method: 'POST', ...jsonBody({ reason }) }),
};
