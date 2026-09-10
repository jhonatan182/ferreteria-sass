import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from '@ferreteria/validation';

/**
 * Query del listado de proveedores. Siempre acotado al tenant activo en el
 * servicio (AGENTS.md 5). Busqueda parcial por nombre, identificacion, telefono
 * o correo (docs/07 598-607).
 */
export class ListSuppliersQuery {
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

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** `active` (por defecto), `inactive` o `all`. */
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status: 'active' | 'inactive' | 'all' = 'active';
}
