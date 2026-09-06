import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * DTOs de los catalogos tenant-owned: Category, Brand y Unit
 * (docs/04 512-571, docs/05 220-232).
 *
 * Autorizacion (docs/04 seccion 45, D3): categorias y marcas reusan
 * `products.read/create/update`; las unidades usan `products.manage_units`.
 * No se crean permisos `categories.*` / `brands.*` (RN-101, docs/04 seccion 44.2).
 */
export class CreateCategoryDto {
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio.' })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

/** Brand comparte forma con Category. */
export class CreateBrandDto extends CreateCategoryDto {}
export class UpdateBrandDto extends UpdateCategoryDto {}

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(/^[A-Z0-9_]+$/, { message: 'El codigo de unidad admite MAYUSCULAS, digitos y _.' })
  code!: string;

  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio.' })
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  symbol?: string | null;
}

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  symbol?: string | null;
}
