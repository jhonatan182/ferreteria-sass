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
 * Alta de venta (docs/05 830-878, RF-100). Nace SIEMPRE en `DRAFT` (RN-032): no
 * afecta inventario, caja, credito ni saldos (RN-033). El `tenantId` y el
 * `createdByUserId` salen del contexto autenticado (AGENTS.md 4-5).
 *
 * `customerId` es opcional: si se omite se usa el cliente general del tenant
 * (RF-091). `subtotal` y `total` NO se aceptan: los recalcula el backend.
 */
export class CreateSaleDto {
  @IsOptional()
  @IsUUID('4', { message: 'customerId invalido.' })
  customerId?: string;

  /** Fecha de la venta. Por defecto, ahora. */
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'saleDate invalida.' })
  saleDate?: string;

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
  @ArrayMinSize(1, { message: 'La venta debe tener al menos un item.' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];
}
