import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { NON_NEGATIVE_MONEY_PATTERN, QUANTITY_PATTERN } from '@ferreteria/validation';

/**
 * Linea de una compra (docs/04 823-841). El cliente envia SOLO producto,
 * presentacion opcional, cantidad y costo unitario. El backend deriva
 * `conversionFactor`, `baseQuantity` y `unitBaseCost` de la presentacion
 * persistida (AGENTS.md 4): nunca se confia en esos valores del frontend.
 *
 * `quantity` viaja como cadena decimal (fracciones permitidas, AGENTS.md 12).
 * `unitCost` es el costo de UNA unidad capturada: si hay presentacion, es el
 * costo por presentacion completa (p. ej. L 250 por bolsa de 50 lb).
 */
export class PurchaseItemDto {
  @IsUUID('4', { message: 'productId invalido.' })
  productId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'presentationId invalido.' })
  presentationId?: string;

  @IsString()
  @Matches(QUANTITY_PATTERN, { message: 'Cantidad decimal invalida.' })
  quantity!: string;

  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Costo unitario invalido.' })
  unitCost!: string;
}
