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
 * Query del listado de compras (RF-131). Siempre acotado al tenant activo
 * (AGENTS.md 5). Soporta paginacion, rango de fechas, proveedor, estado y
 * busqueda por numero de documento.
 */
export class ListPurchasesQuery {
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

  /** Desde (inclusive), sobre `purchaseDate`. `YYYY-MM-DD` o ISO. */
  @IsOptional()
  @IsISO8601({ strict: false })
  from?: string;

  /** Hasta (inclusive), sobre `purchaseDate`. */
  @IsOptional()
  @IsISO8601({ strict: false })
  to?: string;

  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'COMPLETED', 'CANCELLED', 'all'])
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED' | 'all' = 'all';

  /** Busqueda parcial por numero de documento. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}
