import { z } from 'zod';

import { paginationQuerySchema } from './pagination.js';

/**
 * Query del listado de productos (docs/07 584-607). Extiende la paginacion
 * estandar con busqueda por texto y filtro de estado. La validacion de
 * pertenencia al tenant NO vive aqui: la impone el backend con el tenant
 * activo (AGENTS.md 5).
 */
export const productListQuerySchema = paginationQuerySchema.extend({
  /** Busqueda parcial insensible a mayusculas sobre internalCode, barcode y nombre. */
  search: z.string().trim().min(1).max(120).optional(),
  /** Filtro de estado; por defecto solo activos. `all` incluye inactivos. */
  status: z.enum(['ACTIVE', 'INACTIVE', 'all']).default('ACTIVE'),
  categoryId: z.uuid().optional(),
  brandId: z.uuid().optional(),
});

export type ProductListQueryInput = z.input<typeof productListQuerySchema>;
export type ProductListQueryParsed = z.output<typeof productListQuerySchema>;
