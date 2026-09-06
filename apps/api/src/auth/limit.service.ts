import { Injectable } from '@nestjs/common';

import { ConflictException, ERROR_CODES } from '../common/errors.js';
import type { TenantContext } from './auth.types.js';

/**
 * Servicio centralizado de limites del plan (docs/07 218-229, docs/03 905-925).
 *
 * Estructura preparada para las fases de dominio. `TenantContext.subscription.limits`
 * ya trae los valores del plan (`MAX_USERS`, `MAX_PRODUCTS`, ... `null` = sin
 * limite). El conteo de uso real (usuarios ACTIVE, productos ACTIVE) lo aporta
 * cada modulo, DENTRO de la transaccion de creacion (AGENTS.md 21).
 */
@Injectable()
export class LimitService {
  /** Valor del limite (`null` = sin limite comercial; `undefined` = clave no definida en el plan). */
  value(ctx: TenantContext, key: string): number | null | undefined {
    return ctx.subscription.limits.get(key);
  }

  /**
   * Falla si `currentUsage` ya alcanzo el limite del plan para `key`.
   * `currentUsage` lo calcula el modulo llamador.
   */
  assertWithinLimit(ctx: TenantContext, key: string, currentUsage: number): void {
    const limit = this.value(ctx, key);
    if (typeof limit === 'number' && currentUsage >= limit) {
      throw new ConflictException(
        ERROR_CODES.PLAN_LIMIT_REACHED,
        `Se alcanzo el limite del plan para "${key}" (${limit}).`,
        { key, limit, currentUsage },
      );
    }
  }
}
