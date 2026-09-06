import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { RequestContext } from '@ferreteria/types';
import type { CookieOptions, Request, Response } from 'express';

import {
  DEFAULT_LOGIN_RATE_LIMIT,
  DEFAULT_LOGIN_RATE_TTL_SECONDS,
  SESSION_COOKIE_NAME,
} from './auth.constants.js';
import { CurrentUser, Public, TenantOptional } from './auth.decorators.js';
import type { AuthenticatedUser } from './auth.types.js';
import { AuthService, type LoginResult, type MeResult, type PublicUser } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { SelectTenantDto } from './dto/select-tenant.dto.js';

const loginLimit = Number(process.env.AUTH_LOGIN_RATE_LIMIT) || DEFAULT_LOGIN_RATE_LIMIT;
const loginTtl =
  (Number(process.env.AUTH_LOGIN_RATE_TTL_SECONDS) || DEFAULT_LOGIN_RATE_TTL_SECONDS) * 1000;

function sessionCookieOptions(maxAgeMs?: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: (process.env.SESSION_COOKIE_SAMESITE as CookieOptions['sameSite']) ?? 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

/**
 * Superficie de autenticacion (docs/05 88-155). Rutas bajo `/api/auth`.
 *
 * La cookie `ferreteria_session` es httpOnly: el token nunca es accesible
 * desde JS del navegador (docs/07 166-167).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** RF-001. Publico + rate limit (docs/07 786). */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: loginLimit, ttl: loginTtl } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<LoginResult, 'token'>> {
    const result = await this.auth.login(dto.email, dto.password, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });

    res.cookie(
      SESSION_COOKIE_NAME,
      result.token,
      sessionCookieOptions(result.expiresAt.getTime() - Date.now()),
    );

    const { token: _token, ...safe } = result;
    return safe;
  }

  /** RF-004. Invalida la sesion en BD y borra la cookie. */
  @TenantOptional()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.auth.logout(user.sessionId);
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
    return { ok: true };
  }

  /** Usuario autenticado + su contexto (o el selector de tenant si aplica). */
  @TenantOptional()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeResult> {
    return this.auth.me(user);
  }

  /** RF-003. Selecciona el tenant activo de la sesion. */
  @TenantOptional()
  @Post('select-tenant')
  @HttpCode(200)
  async selectTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SelectTenantDto,
  ): Promise<{ context: RequestContext }> {
    const context = await this.auth.selectTenant(user, dto.tenantId);
    return { context };
  }

  /**
   * Endpoint protegido base: exige sesion + membresia + tenant activo +
   * suscripcion utilizable. Sin permiso especifico. Sirve de "pantalla
   * protegida" para el frontend y de sonda de contexto.
   */
  @Get('context')
  context(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { context?: RequestContext },
  ): { user: PublicUser; context: RequestContext } {
    return {
      user: {
        id: user.userId,
        name: user.name,
        email: user.email,
        isPlatformAdmin: user.isPlatformAdmin,
      },
      context: req.context!,
    };
  }
}
