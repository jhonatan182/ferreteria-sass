import type { Paginated } from '@ferreteria/types';

import { apiFetch } from './api';

/** Respuestas de la API de inventario. Cantidades y dinero llegan como cadena. */

export interface InventoryBalanceListItem {
  productId: string;
  internalCode: string;
  barcode: string | null;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  baseUnitCode: string;
  quantity: string;
  averageCost: string;
  inventoryValue: string;
}

export interface ProductInventory {
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

export interface KardexEntry {
  id: string;
  date: string;
  type: string;
  entrada: string;
  salida: string;
  saldo: string;
  unitCode: string;
  unitCost: string | null;
  userName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
}

export interface AdjustmentResult {
  adjustmentId: string;
  movementId: string;
  productId: string;
  internalCode: string;
  name: string;
  direction: 'IN' | 'OUT';
  quantity: string;
  previousQuantity: string;
  resultingQuantity: string;
  averageCost: string;
}

export interface InventoryListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'all';
  stock?: 'all' | 'with' | 'without';
  categoryId?: string;
  brandId?: string;
}

export interface KardexParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  type?: string;
}

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

export const KARDEX_TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Compra',
  SALE: 'Venta',
  RETURN_IN: 'Devolución (entrada)',
  RETURN_OUT: 'Devolución (salida)',
  ADJUSTMENT_IN: 'Ajuste (+)',
  ADJUSTMENT_OUT: 'Ajuste (−)',
  REVERSAL: 'Reverso',
};

export const inventoryApi = {
  list: (params: InventoryListParams = {}): Promise<Paginated<InventoryBalanceListItem>> =>
    apiFetch(`/inventory${query({ ...params })}`),

  getProduct: (productId: string): Promise<ProductInventory> =>
    apiFetch(`/inventory/products/${productId}`),

  kardex: (productId: string, params: KardexParams = {}): Promise<Paginated<KardexEntry>> =>
    apiFetch(`/inventory/products/${productId}/kardex${query({ ...params })}`),

  createAdjustment: (data: {
    productId: string;
    direction: 'IN' | 'OUT';
    quantity: string;
    reason: string;
  }): Promise<AdjustmentResult> =>
    apiFetch('/inventory/adjustments', { method: 'POST', ...jsonBody(data) }),

  changeCost: (
    productId: string,
    data: { averageCost: string; reason: string },
  ): Promise<ProductInventory> =>
    apiFetch(`/inventory/products/${productId}/cost`, { method: 'POST', ...jsonBody(data) }),
};
