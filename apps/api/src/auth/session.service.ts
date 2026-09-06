import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service.js';
import type { Session } from '../generated/prisma/client.js';
import { DEFAULT_SESSION_TTL_HOURS, SESSION_TOKEN_BYTES } from './auth.constants.js';

export interface SessionMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface IssuedSession {
  /** Token en claro — se envia UNA vez al cliente en la cookie. Nunca se persiste. */
  token: string;
  session: Session;
  expiresAt: Date;
}

/**
 * Ciclo de vida de las sesiones opacas (docs/07 seccion 43).
 *
 * El cliente solo posee un token aleatorio; en BD se guarda su SHA-256.
 * Expiracion deslizante hasta el tope `SESSION_TTL_HOURS`. Revocacion real
 * (RF-004): `revokedAt` invalida la sesion de inmediato.
 */
@Injectable()
export class SessionService {
  private readonly ttlHours: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ttlHours = Number(config.get('SESSION_TTL_HOURS')) || DEFAULT_SESSION_TTL_HOURS;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private nextExpiry(from: Date = new Date()): Date {
    return new Date(from.getTime() + this.ttlHours * 3_600_000);
  }

  /** Crea una sesion. `activeTenantId` se fija solo si el usuario tiene una unica membresia. */
  async issue(
    userId: string,
    activeTenantId: string | null,
    meta: SessionMeta = {},
  ): Promise<IssuedSession> {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
    const expiresAt = this.nextExpiry();
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        activeTenantId,
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
      },
    });
    return { token, session, expiresAt };
  }

  /**
   * Resuelve una sesion valida a partir del token en claro. Desliza la
   * expiracion (a lo sumo una escritura por minuto). Devuelve `null` si el
   * token es desconocido, esta revocado o expirado.
   */
  async resolve(token: string): Promise<Session | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const now = new Date();
    if (now.getTime() - session.lastUsedAt.getTime() > 60_000) {
      return this.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: now, expiresAt: this.nextExpiry(now) },
      });
    }
    return session;
  }

  setActiveTenant(sessionId: string, tenantId: string | null): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { activeTenantId: tenantId },
    });
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoca todas las sesiones activas de un usuario (desactivacion, cambio de credencial). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
