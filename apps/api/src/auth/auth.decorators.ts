import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestContext } from '@ferreteria/types';

import type { AuthenticatedRequest, AuthenticatedUser, TenantContext } from './auth.types.js';

export const METADATA_KEYS = {
  public: 'auth:public',
  platformAdmin: 'auth:platformAdmin',
  tenantOptional: 'auth:tenantOptional',
  permissions: 'auth:permissions',
} as const;

/** Ruta sin autenticacion (login, health). */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(METADATA_KEYS.public, true);

/**
 * Ruta exclusiva de Platform Admin: exige usuario autenticado con
 * `isPlatformAdmin` y NO resuelve contexto de tenant (RP-006/RP-008 — el
 * Platform Admin no entra a datos de tenant).
 */
export const PlatformAdminOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(METADATA_KEYS.platformAdmin, true);

/**
 * Ruta que exige autenticacion pero funciona sin tenant resuelto
 * (`/auth/me`, `/auth/select-tenant`, `/auth/logout`).
 */
export const TenantOptional = (): MethodDecorator & ClassDecorator =>
  SetMetadata(METADATA_KEYS.tenantOptional, true);

/**
 * Permisos requeridos para la ruta (RF-010). Se exige TENER TODOS.
 * La ausencia de permiso explicito = denegado (RF-012 / RP-033).
 */
export const RequirePermissions = (...codes: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(METADATA_KEYS.permissions, codes);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new UnauthorizedException('Sin usuario autenticado en la peticion.');
    }
    return request.auth;
  },
);

export const CurrentContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.context) {
      throw new UnauthorizedException('Sin contexto de tenant en la peticion.');
    }
    return request.context;
  },
);

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.tenantContext) {
      throw new UnauthorizedException('Sin contexto de tenant en la peticion.');
    }
    return request.tenantContext;
  },
);
