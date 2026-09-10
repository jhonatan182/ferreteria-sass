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
 * Alta de compra (docs/05 459-489, RF-080). Nace SIEMPRE en `DRAFT` (RN-027):
 * no afecta inventario, costo ni saldos (RN-028). El `tenantId` y el
 * `createdByUserId` salen del contexto autenticado (AGENTS.md 4-5).
 */
export class CreatePurchaseDto {
  @IsUUID('4', { message: 'supplierId invalido.' })
  supplierId!: string;

  /** Fecha del documento de compra. Por defecto, ahora. */
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'purchaseDate invalida.' })
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** Descuento de cabecera. Cadena decimal no negativa. */
  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Descuento invalido.' })
  discount?: string;

  /** Impuesto de cabecera. Cadena decimal no negativa. */
  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Impuesto invalido.' })
  tax?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La compra debe tener al menos un item.' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}
