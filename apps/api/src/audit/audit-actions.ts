/**
 * Vocabulario de acciones de la auditoria operativa (AuditLog.action).
 *
 * docs/04 1299-1311 da ejemplos (`PRODUCT_PRICE_CHANGED`, ...) pero no fija un
 * catalogo cerrado. Se declara como constante para no usar strings libres y
 * para que el futuro `GET /audit` pueda filtrar por accion.
 *
 * docs/05 1814-1835 / RF-140: como minimo deben auditarse el cambio de precio,
 * el cambio de costo (fuera de esta fase, D4) y las activaciones/desactivaciones
 * relevantes.
 */
export const AUDIT_ACTIONS = {
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  PRODUCT_ACTIVATED: 'PRODUCT_ACTIVATED',
  PRODUCT_DEACTIVATED: 'PRODUCT_DEACTIVATED',
  PRODUCT_PRICE_CHANGED: 'PRODUCT_PRICE_CHANGED',
  PRESENTATION_CREATED: 'PRESENTATION_CREATED',
  PRESENTATION_UPDATED: 'PRESENTATION_UPDATED',
  PRESENTATION_DEFAULT_CHANGED: 'PRESENTATION_DEFAULT_CHANGED',
  PRESENTATION_ACTIVATED: 'PRESENTATION_ACTIVATED',
  PRESENTATION_DEACTIVATED: 'PRESENTATION_DEACTIVATED',
  CATALOG_ITEM_CREATED: 'CATALOG_ITEM_CREATED',
  CATALOG_ITEM_UPDATED: 'CATALOG_ITEM_UPDATED',
  CATALOG_ITEM_ACTIVATED: 'CATALOG_ITEM_ACTIVATED',
  CATALOG_ITEM_DEACTIVATED: 'CATALOG_ITEM_DEACTIVATED',
  // Fase 5 — inventario (docs/04 1299-1311, docs/05 1814-1835 / RF-140).
  INVENTORY_ADJUSTED: 'INVENTORY_ADJUSTED',
  PRODUCT_COST_CHANGED: 'PRODUCT_COST_CHANGED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
