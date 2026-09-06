import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ERROR_CODES, ForbiddenException } from '../../common/errors.js';
import { METADATA_KEYS } from '../auth.decorators.js';
import type { AuthenticatedRequest } from '../auth.types.js';

/**
 * Paso de permisos (RF-010). Autoriza POR PERMISO, nunca por nombre de rol
 * (RP-002, RP-032). Exige tener TODOS los permisos declarados con
 * `@RequirePermissions(...)`. Sin contexto de tenant resuelto => denegado
 * (RP-033, denegacion por defecto).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(METADATA_KEYS.permissions, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    if (required.length === 0) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const context = request.context;
    if (!context) {
      throw new ForbiddenException(
        ERROR_CODES.PERMISSION_DENIED,
        'Sin contexto de tenant para evaluar permisos.',
      );
    }

    const granted = new Set(context.permissions);
    const missing = required.filter((code) => !granted.has(code));
    if (missing.length > 0) {
      throw new ForbiddenException(
        ERROR_CODES.PERMISSION_DENIED,
        `No tienes el permiso requerido: ${missing.join(', ')}.`,
        { required, missing },
      );
    }
    return true;
  }
}
