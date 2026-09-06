import type { ApiError } from '@ferreteria/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/** Error de la API con su codigo funcional estable (ver `@ferreteria/types` ApiError). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Cliente HTTP del frontend. SIEMPRE con `credentials: 'include'`: la sesion
 * viaja en la cookie httpOnly `ferreteria_session`, nunca en JS
 * (docs/07 166-167). El frontend no guarda tokens ni decide permisos.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = (body ?? {}) as Partial<ApiError>;
    throw new ApiRequestError(
      res.status,
      err.code ?? 'UNKNOWN',
      err.message ?? `Error ${res.status}`,
      err.details,
    );
  }

  return body as T;
}
