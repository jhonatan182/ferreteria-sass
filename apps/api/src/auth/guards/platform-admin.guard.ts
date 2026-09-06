import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ERROR_CODES, ForbiddenException, UnauthenticatedException } from '../../common/errors.js';
import { METADATA_KEYS } from '../auth.decorators.js';
import type { AuthenticatedRequest } from '../auth.types.js';

/**
 * Superficie de plataforma (RP-006/RP-007). Solo actua sobre rutas marcadas
 * con `@PlatformAdminOnly()`. Mantiene al Platform Admin SEPARADO del acceso a
 * tenants: estas rutas nunca resuelven contexto de tenant (RP-008).
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPlatformRoute =
      this.reflector.getAllAndOverride<boolean>(METADATA_KEYS.platformAdmin, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? false;

    if (!isPlatformRoute) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new UnauthenticatedException();
    }
    if (!request.auth.isPlatformAdmin) {
      throw new ForbiddenException(
        ERROR_CODES.PLATFORM_ADMIN_REQUIRED,
        'Se requiere ser administrador de plataforma.',
      );
    }
    return true;
  }
}
