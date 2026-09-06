import { IsUUID } from 'class-validator';

/**
 * Cuerpo de `POST /auth/select-tenant`. El `tenantId` es solo una PROPUESTA:
 * el backend lo valida contra las membresias reales del usuario antes de
 * persistirlo en la sesion (docs/00 191-203, docs/05 147-155).
 */
export class SelectTenantDto {
  @IsUUID('4', { message: 'tenantId invalido.' })
  tenantId!: string;
}
