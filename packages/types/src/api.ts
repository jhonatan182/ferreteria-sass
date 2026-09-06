/**
 * Forma estable de error de la API.
 * Ver AGENTS.md seccion 26 y docs/07-ARQUITECTURA-TECNICA.md seccion 24.
 * El `code` es un identificador funcional estable (p. ej. "INSUFFICIENT_STOCK").
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Envoltura estandar de respuesta paginada.
 * Ver docs/07-ARQUITECTURA-TECNICA.md seccion 29.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Parametros de consulta de paginacion aceptados por los listados.
 * La validacion runtime vive en `@ferreteria/validation`.
 */
export interface PaginationQuery {
  page: number;
  pageSize: number;
}
