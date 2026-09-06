import { z } from 'zod';

/** Tamano de pagina maximo permitido por los listados del backend. */
export const MAX_PAGE_SIZE = 100;

/**
 * Query de paginacion. Coacciona strings de querystring a numero.
 * Ver docs/07-ARQUITECTURA-TECNICA.md seccion 29.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type PaginationQueryInput = z.input<typeof paginationQuerySchema>;
export type PaginationQueryParsed = z.output<typeof paginationQuerySchema>;
