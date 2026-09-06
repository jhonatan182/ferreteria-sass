import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Edicion de producto (docs/05 flujo de edicion, RF-050). No cambia el precio
 * (eso es `POST /presentations/:id/price` con `products.change_price`) ni el
 * estado (`activate` / `deactivate`).
 *
 * `@IsOptional()` admite `null` para limpiar `categoryId`, `brandId`, `barcode`
 * o `description`.
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  barcode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId invalido.' })
  categoryId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'brandId invalido.' })
  brandId?: string | null;

  /** Solo se permite cambiar la unidad base si el producto aun no tiene presentaciones. */
  @IsOptional()
  @IsUUID('4', { message: 'baseUnitId invalido.' })
  baseUnitId?: string;
}
