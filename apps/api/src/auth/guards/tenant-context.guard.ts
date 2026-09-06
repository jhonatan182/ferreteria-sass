import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  ConflictException,
  ERROR_CODES,
  ForbiddenException,
  UnauthenticatedException,
} from '../../common/errors.js';
import { METADATA_KEYS } from '../auth.decorators.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { SessionService } from '../session.service.js';
import { TenantContextService } from '../tenant-context.service.js';

/**
 * Pasos 2-4 de la cadena (AGENTS.md 6): Membership -> Tenant -> Subscription.
 *
 * El tenant activo SIEMPRE sale de la sesion (`session.activeTenantId`), nunca
 * de la peticion (docs/00 191-203, RN-003). Reglas de seleccion (docs/05 128-155):
 *   - 0 membresias activas  -> NO_TENANT_ACCESS
 *   - 1 membresia activa    -> auto-seleccion (se persiste en la sesion)
 *   - >1 y ninguna elegida  -> TENANT_SELECTION_REQUIRED
 *
 * Rutas `@Public()` y `@PlatformAdminOnly()` se saltan por completo.
 * Rutas `@TenantOptional()` no fallan si el contexto no se puede resolver:
 * simplemente no se adjunta (`/auth/me` lo usa para mostrar el selector).
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.flag(ctx, METADATA_KEYS.public) || this.flag(ctx, METADATA_KEYS.platformAdmin)) {
      return true;
    }

    const optional = this.flag(ctx, METADATA_KEYS.tenantOptional);
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;
    if (!auth) {
      throw new UnauthenticatedException();
    }

    let tenantId = auth.activeTenantId;

    if (!tenantId) {
      const memberships = await this.tenantContext.listActiveMemberships(auth.userId);
      if (memberships.length === 0) {
        if (optional) {
          return true;
        }
        throw new ForbiddenException(
          ERROR_CODES.NO_TENANT_ACCESS,
          'Tu usuario no tiene acceso a ningun tenant.',
        );
      }
      if (memberships.length > 1) {
        if (optional) {
          return true;
        }
        throw new ConflictException(
          ERROR_CODES.TENANT_SELECTION_REQUIRED,
          'Selecciona un tenant para continuar.',
          { tenants: memberships.map((m) => ({ id: m.tenantId, name: m.tenantName })) },
        );
      }
      tenantId = memberships[0]!.tenantId;
      await this.sessions.setActiveTenant(auth.sessionId, tenantId);
      auth.activeTenantId = tenantId;
    }

    const resolution = await this.tenantContext.resolve(auth.userId, tenantId);
    if (!resolution.ok) {
      if (optional) {
        return true;
      }
      throw new ForbiddenException(resolution.code, resolution.message);
    }

    request.tenantContext = resolution.value;
    request.context = resolution.value.context;
    return true;
  }

  private flag(ctx: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [ctx.getHandler(), ctx.getClass()]) ?? false
    );
  }
}
