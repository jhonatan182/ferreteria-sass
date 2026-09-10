import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Alta de proveedor (docs/04 767-785, RF-070). TENANT-OWNED: el `tenantId` sale
 * del contexto, nunca del body (AGENTS.md 4-5). Solo `name` es obligatorio; el
 * proveedor nace activo.
 */
export class CreateSupplierDto {
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio.' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  identification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Correo invalido.' })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
