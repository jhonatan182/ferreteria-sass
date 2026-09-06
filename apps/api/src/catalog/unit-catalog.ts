/**
 * Unidades de medida por defecto de un tenant nuevo (docs/04 552-571, RN-011,
 * docs/05 220-232: "unidades" entre lo que se configura al crear el tenant).
 *
 * Decision docs/04 seccion 45 (D1): `Unit` es TENANT-OWNED, no un catalogo
 * global. Esta lista es la plantilla que consumen:
 *   - el seed (prisma/seed.ts), al crear el tenant de desarrollo;
 *   - el futuro provisioning de tenants (crear tenant => sembrar sus unidades).
 *
 * Cada tenant recibe su propia copia y puede editarla con `products.manage_units`.
 * El `code` es unico por tenant (`@@unique([tenantId, code])`).
 */

export interface UnitTemplate {
  code: string;
  name: string;
  symbol: string | null;
}

export const DEFAULT_TENANT_UNITS: readonly UnitTemplate[] = [
  { code: 'UNIDAD', name: 'Unidad', symbol: 'u' },
  { code: 'LIBRA', name: 'Libra', symbol: 'lb' },
  { code: 'KILOGRAMO', name: 'Kilogramo', symbol: 'kg' },
  { code: 'QUINTAL', name: 'Quintal', symbol: 'qq' },
  { code: 'METRO', name: 'Metro', symbol: 'm' },
  { code: 'PIE', name: 'Pie', symbol: 'ft' },
  { code: 'LITRO', name: 'Litro', symbol: 'L' },
  { code: 'GALON', name: 'Galon', symbol: 'gal' },
  { code: 'CAJA', name: 'Caja', symbol: null },
  { code: 'ROLLO', name: 'Rollo', symbol: null },
];

export const DEFAULT_TENANT_UNIT_CODES: readonly string[] = DEFAULT_TENANT_UNITS.map((u) => u.code);
