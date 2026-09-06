import type { Paginated } from '@ferreteria/types';

import { apiFetch } from './api';

/** Respuestas de la API de productos y catalogos. El dinero llega como cadena. */

export type CatalogStatus = 'ACTIVE' | 'INACTIVE';

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  status: CatalogStatus;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  status: CatalogStatus;
}

export interface Presentation {
  id: string;
  name: string;
  unitId: string;
  unitCode: string;
  conversionFactor: string;
  salePrice: string;
  isDefault: boolean;
  status: CatalogStatus;
}

export interface ProductListItem {
  id: string;
  internalCode: string;
  barcode: string | null;
  name: string;
  status: CatalogStatus;
  categoryName: string | null;
  brandName: string | null;
  baseUnitCode: string;
  defaultPrice: string | null;
}

export interface ProductDetail {
  id: string;
  internalCode: string;
  barcode: string | null;
  name: string;
  description: string | null;
  status: CatalogStatus;
  categoryId: string | null;
  brandId: string | null;
  baseUnitId: string;
  baseUnitCode: string;
  createdAt: string;
  updatedAt: string;
  presentations: Presentation[];
}

export interface ProductListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'all';
  categoryId?: string;
  brandId?: string;
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

export const productsApi = {
  list: (params: ProductListParams = {}): Promise<Paginated<ProductListItem>> =>
    apiFetch(`/products${query({ ...params })}`),

  get: (id: string): Promise<ProductDetail> => apiFetch(`/products/${id}`),

  create: (data: Record<string, unknown>): Promise<ProductDetail> =>
    apiFetch('/products', { method: 'POST', ...jsonBody(data) }),

  update: (id: string, data: Record<string, unknown>): Promise<ProductDetail> =>
    apiFetch(`/products/${id}`, { method: 'PATCH', ...jsonBody(data) }),

  activate: (id: string): Promise<ProductDetail> =>
    apiFetch(`/products/${id}/activate`, { method: 'POST' }),

  deactivate: (id: string): Promise<ProductDetail> =>
    apiFetch(`/products/${id}/deactivate`, { method: 'POST' }),

  createPresentation: (productId: string, data: Record<string, unknown>): Promise<Presentation> =>
    apiFetch(`/products/${productId}/presentations`, { method: 'POST', ...jsonBody(data) }),

  updatePresentation: (
    productId: string,
    presentationId: string,
    data: Record<string, unknown>,
  ): Promise<Presentation> =>
    apiFetch(`/products/${productId}/presentations/${presentationId}`, {
      method: 'PATCH',
      ...jsonBody(data),
    }),

  changePrice: (
    productId: string,
    presentationId: string,
    data: { salePrice: string; reason?: string },
  ): Promise<Presentation> =>
    apiFetch(`/products/${productId}/presentations/${presentationId}/price`, {
      method: 'POST',
      ...jsonBody(data),
    }),

  setDefaultPresentation: (productId: string, presentationId: string): Promise<Presentation> =>
    apiFetch(`/products/${productId}/presentations/${presentationId}/set-default`, {
      method: 'POST',
    }),

  setPresentationStatus: (
    productId: string,
    presentationId: string,
    active: boolean,
  ): Promise<Presentation> =>
    apiFetch(
      `/products/${productId}/presentations/${presentationId}/${active ? 'activate' : 'deactivate'}`,
      { method: 'POST' },
    ),
};

function namedCatalogApi(base: 'categories' | 'brands') {
  return {
    list: (includeInactive = false): Promise<CatalogItem[]> =>
      apiFetch(`/${base}${includeInactive ? '?status=all' : ''}`),
    create: (data: { name: string; description?: string }): Promise<CatalogItem> =>
      apiFetch(`/${base}`, { method: 'POST', ...jsonBody(data) }),
    update: (id: string, data: Record<string, unknown>): Promise<CatalogItem> =>
      apiFetch(`/${base}/${id}`, { method: 'PATCH', ...jsonBody(data) }),
    setStatus: (id: string, active: boolean): Promise<CatalogItem> =>
      apiFetch(`/${base}/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
  };
}

export const categoriesApi = namedCatalogApi('categories');
export const brandsApi = namedCatalogApi('brands');

export const unitsApi = {
  list: (includeInactive = false): Promise<Unit[]> =>
    apiFetch(`/units${includeInactive ? '?status=all' : ''}`),
  create: (data: { code: string; name: string; symbol?: string }): Promise<Unit> =>
    apiFetch('/units', { method: 'POST', ...jsonBody(data) }),
  update: (id: string, data: Record<string, unknown>): Promise<Unit> =>
    apiFetch(`/units/${id}`, { method: 'PATCH', ...jsonBody(data) }),
  setStatus: (id: string, active: boolean): Promise<Unit> =>
    apiFetch(`/units/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
};
