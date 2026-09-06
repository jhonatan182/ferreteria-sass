import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@ferreteria/types';

import { PrismaService } from '../prisma/prisma.service.js';
import { ERROR_CODES, type ErrorCode } from '../common/errors.js';
import type { ResolvedSubscription, ResolvedTenant, TenantContext } from './auth.types.js';

/** Resumen de una membresia activa del usuario, para login / seleccion de tenant. */
export interface MembershipSummary {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  roleId: string;
  roleName: string;
}

export type TenantResolution =
  { ok: true; value: TenantContext } | { ok: false; code: ErrorCode; message: string };

/** Suscripciones que permiten operar (docs/05 1655, indice parcial de `subscriptions`). */
const USABLE_SUBSCRIPTION_STATUSES = ['ACTIVE', 'PAST_DUE'] as const;

/**
 * Construye y valida el contexto autenticado del tenant siguiendo el orden de
 * AGENTS.md 6 y docs/07 173-195:
 *
 *   Membership -> Tenant status -> Subscription -> (Feature / Limit) -> Permission
 *
 * Nunca confia en un tenantId de la peticion: siempre parte del `userId`
 * autenticado y del tenant persistido en la sesion, y revalida la membresia
 * real (docs/00 191-203, RN-003).
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  /** Membresias ACTIVE del usuario, con nombre de tenant y rol. */
  async listActiveMemberships(userId: string): Promise<MembershipSummary[]> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { tenant: true, role: true },
      orderBy: { tenant: { name: 'asc' } },
    });
    return memberships.map((m) => ({
      membershipId: m.id,
      tenantId: m.tenantId,
      tenantName: m.tenant.name,
      tenantStatus: m.tenant.status,
      roleId: m.roleId,
      roleName: m.role.name,
    }));
  }

  /**
   * Resuelve el contexto para `(userId, tenantId)`. No lanza: devuelve un
   * resultado discriminado para que el llamador decida el codigo HTTP
   * (los guards) o lo trate como estado (`/auth/me`).
   */
  async resolve(userId: string, tenantId: string): Promise<TenantResolution> {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: { tenant: true, role: true },
    });

    if (!membership) {
      return {
        ok: false,
        code: ERROR_CODES.TENANT_ACCESS_DENIED,
        message: 'No perteneces al tenant seleccionado.',
      };
    }
    if (membership.status !== 'ACTIVE') {
      return {
        ok: false,
        code: ERROR_CODES.MEMBERSHIP_INACTIVE,
        message: 'Tu acceso a este tenant esta inactivo.',
      };
    }
    if (membership.tenant.status !== 'ACTIVE') {
      return {
        ok: false,
        code: ERROR_CODES.TENANT_SUSPENDED,
        message: 'El tenant esta suspendido.',
      };
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: [...USABLE_SUBSCRIPTION_STATUSES] } },
      include: {
        plan: { include: { features: { include: { feature: true } }, limits: true } },
      },
    });

    if (!subscription) {
      return {
        ok: false,
        code: ERROR_CODES.SUBSCRIPTION_UNUSABLE,
        message: 'La suscripcion del tenant no permite operar.',
      };
    }

    const permissions = await this.loadPermissions(membership.roleId);

    const tenant: ResolvedTenant = {
      id: membership.tenant.id,
      name: membership.tenant.name,
      status: membership.tenant.status,
      baseCurrency: membership.tenant.baseCurrency,
      timezone: membership.tenant.timezone,
    };

    const resolvedSubscription: ResolvedSubscription = {
      id: subscription.id,
      status: subscription.status,
      planId: subscription.planId,
      planCode: subscription.plan.code,
      currentPeriodEnd: subscription.currentPeriodEnd,
      features: new Set(
        subscription.plan.features.filter((f) => f.enabled).map((f) => f.feature.code),
      ),
      limits: new Map(subscription.plan.limits.map((l) => [l.key, l.value])),
    };

    const context: RequestContext = {
      userId,
      tenantId,
      membershipId: membership.id,
      roleId: membership.roleId,
      permissions,
    };

    return { ok: true, value: { context, tenant, subscription: resolvedSubscription } };
  }

  private async loadPermissions(roleId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rows.map((r) => r.permission.code).toSorted();
  }
}
