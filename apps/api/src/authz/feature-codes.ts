/**
 * Catalogo global de features (funcionalidades comerciales activables por plan).
 *
 * docs/00-DISENO-SAAS.md 240-246, docs/04-MODELO-DE-DOMINIO.md 317-328.
 *
 * Una feature determina si una funcionalidad esta DISPONIBLE para el tenant
 * segun su plan. No se debe confundir con un permiso, que determina si un
 * usuario puede ejecutar una accion dentro de esa funcionalidad
 * (docs/03-ROLES-Y-PERMISOS.md 865-901).
 *
 * PROHIBIDO ramificar logica por nombre de plan (AGENTS.md 19). El acceso
 * funcional se resuelve consultando estas features via el servicio central
 * (docs/07 218-229: `featureService.has("CREDITS")`).
 */

export interface FeatureDefinition {
  code: string;
  name: string;
  description: string;
}

export const FEATURE_CATALOG: readonly FeatureDefinition[] = [
  { code: 'CREDITS', name: 'Creditos', description: 'Cuentas de credito y abonos de clientes' },
  { code: 'CASH', name: 'Caja', description: 'Sesiones y movimientos de caja' },
  {
    code: 'ADVANCED_REPORTS',
    name: 'Reportes avanzados',
    description: 'Reportes de utilidad y analiticos',
  },
  { code: 'PAYROLL', name: 'Planilla', description: 'Gestion de planilla (futuro)' },
];

export const FEATURE_CODES: readonly string[] = FEATURE_CATALOG.map((f) => f.code);

export const FEATURE_CODE_SET: ReadonlySet<string> = new Set(FEATURE_CODES);
