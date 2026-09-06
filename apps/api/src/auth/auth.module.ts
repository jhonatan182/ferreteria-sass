import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AllExceptionsFilter } from '../common/all-exceptions.filter.js';
import { AuthController } from './auth.controller.js';
import { DEFAULT_LOGIN_RATE_LIMIT, DEFAULT_LOGIN_RATE_TTL_SECONDS } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { FeatureService } from './feature.service.js';
import { AuthenticationGuard } from './guards/authentication.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { PlatformAdminGuard } from './guards/platform-admin.guard.js';
import { TenantContextGuard } from './guards/tenant-context.guard.js';
import { LimitService } from './limit.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { TenantContextService } from './tenant-context.service.js';

/**
 * Modulo de autenticacion, contexto de tenant y autorizacion base.
 *
 * Registra CUATRO guards globales, en el orden de la cadena de autorizacion
 * (AGENTS.md 6, docs/07 173-214):
 *   1. AuthenticationGuard  — identidad (cookie de sesion, usuario ACTIVE)
 *   2. PlatformAdminGuard   — superficie de plataforma (solo rutas marcadas)
 *   3. TenantContextGuard   — membresia -> tenant -> suscripcion
 *   4. PermissionsGuard     — permiso requerido (@RequirePermissions)
 *
 * Feature y limite (paso 5-6) tienen servicios listos pero aun no se aplican
 * como guards: los invocan los modulos de dominio cuando existan.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { ttl: DEFAULT_LOGIN_RATE_TTL_SECONDS * 1000, limit: DEFAULT_LOGIN_RATE_LIMIT },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    PasswordService,
    SessionService,
    TenantContextService,
    AuthService,
    FeatureService,
    LimitService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: PlatformAdminGuard },
    { provide: APP_GUARD, useClass: TenantContextGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [TenantContextService, FeatureService, LimitService, SessionService],
})
export class AuthModule {}
