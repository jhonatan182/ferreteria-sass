import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { parseCookies } from '../../common/cookies.js';
import { ERROR_CODES, ForbiddenException, UnauthenticatedException } from '../../common/errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SESSION_COOKIE_NAME } from '../auth.constants.js';
import { METADATA_KEYS } from '../auth.decorators.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { SessionService } from '../session.service.js';

/**
 * Paso 1 de la cadena de autorizacion (AGENTS.md 6): identidad.
 *
 * Lee la cookie de sesion, resuelve la sesion opaca, carga el usuario y
 * verifica que este ACTIVE en CADA request (RF-002, docs/07 164 "usuario
 * activo"). Un usuario desactivado ve revocadas todas sus sesiones.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.isPublic(ctx)) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME];
    if (!token) {
      throw new UnauthenticatedException();
    }

    const session = await this.sessions.resolve(token);
    if (!session) {
      throw new UnauthenticatedException(
        'Sesion invalida o expirada.',
        ERROR_CODES.SESSION_EXPIRED,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      throw new UnauthenticatedException(
        'Sesion invalida o expirada.',
        ERROR_CODES.SESSION_EXPIRED,
      );
    }
    if (user.status !== 'ACTIVE') {
      await this.sessions.revokeAllForUser(user.id);
      throw new ForbiddenException(ERROR_CODES.ACCOUNT_INACTIVE, 'Tu cuenta esta inactiva.');
    }

    request.auth = {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
      activeTenantId: session.activeTenantId,
    };
    return true;
  }

  private isPublic(ctx: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(METADATA_KEYS.public, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? false
    );
  }
}
