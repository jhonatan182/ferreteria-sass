import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { CreatePresentationDto } from './create-presentation.dto.js';

/**
 * Alta de producto (docs/05 236-287, RF-050). Campos minimos: nombre y unidad
 * base; el estado nace ACTIVE. `internalCode` es opcional: si no se envia, el
 * backend lo autogenera (docs/05 290-318, D2).
 *
 * El backend es la autoridad: revalida tenant, unicidad, unidad y presentaciones
 * aunque el DTO pase (AGENTS.md 4).
 */
export class CreateProductDto {
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio.' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\-_.]*$/, {
    message: 'El codigo interno solo admite letras, digitos y - _ .',
  })
  internalCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  barcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId invalido.' })
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'brandId invalido.' })
  brandId?: string;

  @IsUUID('4', { message: 'baseUnitId invalido.' })
  baseUnitId!: string;

  /** Presentaciones iniciales (opcional). La primera queda como principal. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreatePresentationDto)
  presentations?: CreatePresentationDto[];
}
