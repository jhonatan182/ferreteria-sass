import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from '@ferreteria/validation';

/**
 * Query del listado de existencias (docs/06 244-249, docs/07 584-607). El
 * listado esta guiado por `Product` del tenant activo (AGENTS.md 5): un producto
 * sin movimientos aparece con existencia 0.
 */
export class ListInventoryQuery {
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

  /** Busqueda parcial por internalCode, barcode o nombre del producto. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** `ACTIVE` (por defecto), `INACTIVE` o `all` (estado del producto). */
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'all'])
  status: 'ACTIVE' | 'INACTIVE' | 'all' = 'ACTIVE';

  /** `all` (por defecto), `with` (existencia > 0) o `without` (existencia <= 0). */
  @IsOptional()
  @IsIn(['all', 'with', 'without'])
  stock: 'all' | 'with' | 'without' = 'all';

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string;
}
