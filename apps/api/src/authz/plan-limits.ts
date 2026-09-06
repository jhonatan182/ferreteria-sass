/**
 * Claves de limite comercial de un plan (PlanLimit.key).
 *
 * docs/00-DISENO-SAAS.md 248-255, docs/04-MODELO-DE-DOMINIO.md 356-379.
 *
 * PlanLimit es key/value. `value` NULL = sin limite comercial artificial
 * (docs/00 255). Semantica de cada limite:
 *   - MAX_USERS:    usuarios ACTIVOS por tenant. Los inactivos no consumen
 *                   plaza (docs/05 1744-1752).
 *   - MAX_PRODUCTS: productos ACTIVOS por tenant (docs/05 1721-1740).
 *
 * Estas claves se declaran como constante para que el codigo que consulta
 * limites (docs/07 226: `limitService.assertAvailable("MAX_USERS")`) no use
 * strings libres.
 */

export const PLAN_LIMIT_KEYS = ['MAX_USERS', 'MAX_PRODUCTS'] as const;

export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];

export const PLAN_LIMIT_KEY_SET: ReadonlySet<string> = new Set(PLAN_LIMIT_KEYS);
