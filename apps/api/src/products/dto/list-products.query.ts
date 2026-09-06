import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MaxLength } from 'class-validator';
import { MAX_PAGE_SIZE } from '@ferreteria/validation';

/**
 * Query del listado de productos (docs/07 584-607). El `ValidationPipe` global
 * (transform: true) coacciona los strings del querystring. El filtro y la
 * busqueda SIEMPRE se acotan al tenant activo en el servicio (AGENTS.md 5).
 */
export class ListProductsQuery {
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

  /** Busqueda parcial por internalCode, barcode o nombre (docs/07 598-607). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** `ACTIVE` (por defecto), `INACTIVE` o `all`. */
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'all'])
  status: 'ACTIVE' | 'INACTIVE' | 'all' = 'ACTIVE';

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string;
}
