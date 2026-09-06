import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { CONVERSION_FACTOR_PATTERN, NON_NEGATIVE_MONEY_PATTERN } from '@ferreteria/validation';

/**
 * Alta de presentacion (docs/05 322-360, RF-053). `conversionFactor` y
 * `salePrice` viajan como CADENA decimal (AGENTS.md 11-12). El backend valida
 * ademas `conversionFactor > 0` y la pertenencia de la unidad al tenant.
 */
export class CreatePresentationDto {
  @IsString()
  @MinLength(1, { message: 'El nombre de la presentacion es obligatorio.' })
  @MaxLength(120)
  name!: string;

  @IsUUID('4', { message: 'unitId invalido.' })
  unitId!: string;

  @IsString()
  @Matches(CONVERSION_FACTOR_PATTERN, { message: 'Factor de conversion invalido.' })
  conversionFactor!: string;

  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Precio de venta invalido.' })
  salePrice!: string;

  /** Marca esta presentacion como principal del producto (RN-016). */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
