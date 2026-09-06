import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { NON_NEGATIVE_MONEY_PATTERN } from '@ferreteria/validation';

/**
 * Cambio de precio de una presentacion (docs/05 363-394, RP-026). Requiere
 * `products.change_price` y genera auditoria con el precio anterior y el nuevo
 * (RN-076). No afecta ventas historicas (docs/05 391-394).
 */
export class ChangePriceDto {
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Precio de venta invalido.' })
  salePrice!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
