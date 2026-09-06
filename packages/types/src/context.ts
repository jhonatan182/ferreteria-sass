/**
 * Contexto de la peticion autenticada que el backend construye y valida.
 * Copiado de docs/07-ARQUITECTURA-TECNICA.md seccion 5.
 *
 * El backend es la unica autoridad para poblar estos valores.
 * Nunca deben derivarse de datos enviados por el frontend
 * (ver AGENTS.md secciones 4 y 5).
 *
 * Las operaciones de dominio aun no estan implementadas; este contrato
 * se declara ahora porque atraviesa toda la capa de aplicacion.
 */
export interface RequestContext {
  userId: string;
  tenantId: string;
  membershipId: string;
  roleId: string;
  permissions: string[];
}
