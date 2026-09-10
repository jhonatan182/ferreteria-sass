import type { Paginated } from '@ferreteria/types';

import { apiFetch } from './api';

/** Respuestas de la API de proveedores (Fase 6). */

export interface Supplier {
  id: string;
  name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
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

export const suppliersApi = {
  list: (params: SupplierListParams = {}): Promise<Paginated<Supplier>> =>
    apiFetch(`/suppliers${query({ ...params })}`),

  get: (id: string): Promise<Supplier> => apiFetch(`/suppliers/${id}`),

  create: (data: Record<string, unknown>): Promise<Supplier> =>
    apiFetch('/suppliers', { method: 'POST', ...jsonBody(data) }),

  update: (id: string, data: Record<string, unknown>): Promise<Supplier> =>
    apiFetch(`/suppliers/${id}`, { method: 'PATCH', ...jsonBody(data) }),

  setActive: (id: string, active: boolean): Promise<Supplier> =>
    apiFetch(`/suppliers/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
};
