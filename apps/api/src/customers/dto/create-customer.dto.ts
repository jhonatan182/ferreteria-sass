import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Alta de cliente (docs/04 865-891, RF-090). TENANT-OWNED: el `tenantId` sale
 * del contexto, nunca del body (AGENTS.md 4-5). Solo `name` es obligatorio; el
 * cliente nace activo y SIN limite de credito.
 *
 * `creditLimit` y `isGeneralCustomer` NO se aceptan aqui: el limite se cambia
 * con `POST /customers/:id/credit-limit` (permiso `credits.change_limit`) y el
 * cliente general lo crea el provisioning del tenant (docs/04 seccion 48 D1).
 */
export class CreateCustomerDto {
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
