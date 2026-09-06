import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { CONVERSION_FACTOR_PATTERN } from '@ferreteria/validation';

/**
 * Edicion de presentacion (docs/06 RF-053). NO incluye `salePrice`: el precio
 * solo se cambia por `POST /presentations/:id/price`, que es lo que hace
 * efectivo el permiso `products.change_price` (docs/05 363-394, RP-026).
 */
export class UpdatePresentationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID('4', { message: 'unitId invalido.' })
  unitId?: string;

  @IsOptional()
  @IsString()
  @Matches(CONVERSION_FACTOR_PATTERN, { message: 'Factor de conversion invalido.' })
  conversionFactor?: string;
}
