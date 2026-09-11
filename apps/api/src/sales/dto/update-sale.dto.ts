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

import { SaleItemDto } from './sale-item.dto.js';

/**
 * Edicion de una venta en borrador (docs/05 880-888, RF-101). SOLO una venta
 * `DRAFT` puede editarse; el backend lo revalida dentro de la transaccion. Si
 * `items` se envia, REEMPLAZA todas las lineas.
 */
export class UpdateSaleDto {
  @IsOptional()
  @IsUUID('4', { message: 'customerId invalido.' })
  customerId?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'saleDate invalida.' })
  saleDate?: string;

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
  @ArrayMinSize(1, { message: 'La venta debe tener al menos un item.' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items?: SaleItemDto[];
}
