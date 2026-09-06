import type { Request } from 'express';
import type { RequestContext } from '@ferreteria/types';

import type { SubscriptionStatus, TenantStatus } from '../generated/prisma/client.js';

/** Identidad resuelta por `AuthenticationGuard` a partir de la cookie de sesion. */
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  /** Tenant elegido para esta sesion, si ya se selecciono. */
  activeTenantId: string | null;
}

/** Datos del tenant y su suscripcion, resueltos por `TenantContextGuard`. */
export interface ResolvedTenant {
  id: string;
  name: string;
  status: TenantStatus;
  baseCurrency: string;
  timezone: string;
}

export interface ResolvedSubscription {
  id: string;
  status: SubscriptionStatus;
  planId: string;
  planCode: string;
  currentPeriodEnd: Date;
  /** Codigos de feature habilitados por el plan vigente. */
  features: ReadonlySet<string>;
  /** Limites del plan por clave (`null` = sin limite comercial). */
  limits: ReadonlyMap<string, number | null>;
}

/**
 * Contexto completo del tenant para la peticion. `context` es el contrato
 * documentado (`@ferreteria/types` RequestContext, docs/07 113-128); el resto
 * es material para los guards de suscripcion / feature / limite.
 */
export interface TenantContext {
  context: RequestContext;
  tenant: ResolvedTenant;
  subscription: ResolvedSubscription;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthenticatedUser;
  tenantContext?: TenantContext;
  /** Alias directo al contrato documentado, para el decorador `@CurrentContext()`. */
  context?: RequestContext;
}
