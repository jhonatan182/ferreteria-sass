import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { NON_NEGATIVE_MONEY_PATTERN } from '@ferreteria/validation';

/**
 * Cambio del limite de credito de un cliente (RN-051, permiso
 * `credits.change_limit`). Cadena decimal no negativa. `0` = sin credito
 * autorizado. No aplica al cliente general (docs/04 seccion 48 D1).
 */
export class ChangeCreditLimitDto {
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Limite de credito invalido.' })
  creditLimit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
