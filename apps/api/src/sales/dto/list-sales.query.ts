import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_PAGE_SIZE } from '@ferreteria/validation';

/**
 * Query del listado de ventas (docs/07 559-561: paginacion en backend). Siempre
 * acotado al tenant activo (AGENTS.md 5). Soporta paginacion, rango de fechas,
 * cliente, estado y busqueda por numero de documento.
 */
export class ListSalesQuery {
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

  /** Desde (inclusive), sobre `saleDate`. `YYYY-MM-DD` o ISO. */
  @IsOptional()
  @IsISO8601({ strict: false })
  from?: string;

  /** Hasta (inclusive), sobre `saleDate`. */
  @IsOptional()
  @IsISO8601({ strict: false })
  to?: string;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'COMPLETED', 'CANCELLED', 'all'])
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED' | 'all' = 'all';

  /** Busqueda parcial por numero de documento. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}
