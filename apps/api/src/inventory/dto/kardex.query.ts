import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from '@ferreteria/validation';

/** Valores de `InventoryMovementType` aceptados como filtro del kardex. */
export const KARDEX_MOVEMENT_TYPES = [
  'PURCHASE',
  'SALE',
  'RETURN_IN',
  'RETURN_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'REVERSAL',
] as const;

export type KardexMovementType = (typeof KARDEX_MOVEMENT_TYPES)[number];

/**
 * Query del kardex de un producto (docs/05 714-744, RF-062 / RF-133).
 * Soporta rango de fechas, tipo de movimiento y paginacion.
 */
export class KardexQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize = 20;

  /** Fecha/hora inicial inclusiva (ISO 8601: `2026-09-01` o `2026-09-01T00:00:00Z`). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Fecha/hora final inclusiva. Una fecha sin hora cubre el dia completo. */
  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(KARDEX_MOVEMENT_TYPES)
  type?: KardexMovementType;
}
