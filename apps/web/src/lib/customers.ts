import type { Paginated } from '@ferreteria/types';

import { apiFetch } from './api';

/** Respuestas de la API de clientes (Fase 7). El dinero llega como cadena. */

export interface Customer {
  id: string;
  name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditLimit: string;
  isGeneralCustomer: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListParams {
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

export const customersApi = {
  list: (params: CustomerListParams = {}): Promise<Paginated<Customer>> =>
    apiFetch(`/customers${query({ ...params })}`),

  get: (id: string): Promise<Customer> => apiFetch(`/customers/${id}`),

  /** Cliente general del tenant (RF-091). Lo crea de forma perezosa si aun no existe. */
  getGeneral: (): Promise<Customer> => apiFetch('/customers/general'),

  create: (data: Record<string, unknown>): Promise<Customer> =>
    apiFetch('/customers', { method: 'POST', ...jsonBody(data) }),

  update: (id: string, data: Record<string, unknown>): Promise<Customer> =>
    apiFetch(`/customers/${id}`, { method: 'PATCH', ...jsonBody(data) }),

  setActive: (id: string, active: boolean): Promise<Customer> =>
    apiFetch(`/customers/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),

  changeCreditLimit: (id: string, creditLimit: string, reason?: string): Promise<Customer> =>
    apiFetch(`/customers/${id}/credit-limit`, {
      method: 'POST',
      ...jsonBody({ creditLimit, reason }),
    }),
};
