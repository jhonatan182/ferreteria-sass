import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Edicion de datos administrativos del cliente (RF-090). No cambia el estado
 * (`activate` / `deactivate`), el limite de credito ni la marca de cliente
 * general. `@IsOptional()` admite `null` para limpiar los campos opcionales.
 */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  identification?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'Correo invalido.' })
  @MaxLength(200)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;
}
