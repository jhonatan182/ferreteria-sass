import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { QUANTITY_PATTERN } from '@ferreteria/validation';

/**
 * Linea de una venta. El cliente envia SOLO producto, presentacion opcional y
 * cantidad. El PRECIO lo resuelve el backend del `ProductPresentation`
 * seleccionado (RN-015, docs/05 866-878): el DTO NO acepta `unitPrice` ni
 * `discount` — con `forbidNonWhitelisted` enviarlos es 400. El descuento por
 * linea o el precio manual seran una regla explicita con permiso propio en una
 * fase futura (docs/04 seccion 48).
 *
 * `quantity` viaja como cadena decimal (fracciones permitidas, AGENTS.md 12).
 */
export class SaleItemDto {
  @IsUUID('4', { message: 'productId invalido.' })
  productId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'presentationId invalido.' })
  presentationId?: string;

  @IsString()
  @Matches(QUANTITY_PATTERN, { message: 'Cantidad decimal invalida.' })
  quantity!: string;
}
