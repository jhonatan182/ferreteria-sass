import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@ferreteria/types';

import { ERROR_CODES, ForbiddenException, InvalidCredentialsException } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { PasswordService } from './password.service.js';
import { SessionService, type SessionMeta } from './session.service.js';
import { type MembershipSummary, TenantContextService } from './tenant-context.service.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
}

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: PublicUser;
  memberships: MembershipSummary[];
  activeTenantId: string | null;
  requiresTenantSelection: boolean;
}

export interface MeResult {
  user: PublicUser;
  memberships: MembershipSummary[];
  activeTenantId: string | null;
  context: RequestContext | null;
  /** Motivo por el que no hay contexto, cuando aplique (p. ej. TENANT_SUSPENDED). */
  contextIssue: string | null;
  requiresTenantSelection: boolean;
}

const toPublicUser = (u: {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
}): PublicUser => ({ id: u.id, name: u.name, email: u.email, isPlatformAdmin: u.isPlatformAdmin });

/**
 * Orquesta el flujo de inicio de sesion (docs/05 88-155) y el contexto
 * autenticado. La autoridad de negocio es el backend: nada de tenant, rol ni
 * permisos se toma de la peticion (AGENTS.md 4).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async login(email: string, password: string, meta: SessionMeta): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Verificacion en tiempo constante: si el usuario no existe o no tiene
    // credencial, igualmente se consume un `compare` (anti timing oracle).
    const passwordOk = await this.passwords.verify(password, user?.passwordHash);
    if (!user || !passwordOk) {
      throw new InvalidCredentialsException();
    }

    // RF-002: un usuario inactivo no puede iniciar sesion. Respuesta distinta
    // de "credenciales incorrectas" (el llamador ya demostro conocer la clave).
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(ERROR_CODES.ACCOUNT_INACTIVE, 'Tu cuenta esta inactiva.');
    }

    const memberships = await this.tenantContext.listActiveMemberships(user.id);

    // docs/05 96-122: sin tenant activo -> denegar. Excepcion: Platform Admin,
    // que opera en la superficie de plataforma y no tiene membresias (RP-006).
    if (memberships.length === 0 && !user.isPlatformAdmin) {
      throw new ForbiddenException(
        ERROR_CODES.NO_TENANT_ACCESS,
        'Tu usuario no tiene acceso a ningun tenant.',
      );
    }

    const activeTenantId = memberships.length === 1 ? memberships[0]!.tenantId : null;
    const issued = await this.sessions.issue(user.id, activeTenantId, meta);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      token: issued.token,
      expiresAt: issued.expiresAt,
      user: toPublicUser(user),
      memberships,
      activeTenantId,
      requiresTenantSelection: memberships.length > 1,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
  }

  /** Persiste el tenant elegido en la sesion tras validarlo (docs/05 128-155). */
  async selectTenant(auth: AuthenticatedUser, tenantId: string): Promise<RequestContext> {
    const resolution = await this.tenantContext.resolve(auth.userId, tenantId);
    if (!resolution.ok) {
      throw new ForbiddenException(resolution.code, resolution.message);
    }
    await this.sessions.setActiveTenant(auth.sessionId, tenantId);
    return resolution.value.context;
  }

  async me(auth: AuthenticatedUser): Promise<MeResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    const memberships = await this.tenantContext.listActiveMemberships(user.id);

    let context: RequestContext | null = null;
    let contextIssue: string | null = null;

    if (auth.activeTenantId) {
      const resolution = await this.tenantContext.resolve(user.id, auth.activeTenantId);
      if (resolution.ok) {
        context = resolution.value.context;
      } else {
        contextIssue = resolution.code;
      }
    }

    return {
      user: toPublicUser(user),
      memberships,
      activeTenantId: auth.activeTenantId,
      context,
      contextIssue,
      requiresTenantSelection: !context && memberships.length > 1,
    };
  }
}
