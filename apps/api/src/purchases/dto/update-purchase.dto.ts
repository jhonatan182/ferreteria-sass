import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NON_NEGATIVE_MONEY_PATTERN } from '@ferreteria/validation';

import { PurchaseItemDto } from './purchase-item.dto.js';

/**
 * Edicion de una compra en borrador (docs/05 491-509, RF-081). SOLO una compra
 * `DRAFT` puede editarse (RF-083); el backend lo revalida dentro de la
 * transaccion. Si `items` se envia, REEMPLAZA todas las lineas.
 */
export class UpdatePurchaseDto {
  @IsOptional()
  @IsUUID('4', { message: 'supplierId invalido.' })
  supplierId?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'purchaseDate invalida.' })
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Descuento invalido.' })
  discount?: string;

  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Impuesto invalido.' })
  tax?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'La compra debe tener al menos un item.' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items?: PurchaseItemDto[];
}
