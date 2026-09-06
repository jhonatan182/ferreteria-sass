/**
 * Catalogo global de permisos del sistema.
 *
 * Transcripcion literal de docs/03-ROLES-Y-PERMISOS.md secciones 13-25.
 * Un permiso es una accion autorizable con formato `modulo.accion`
 * (docs/04-MODELO-DE-DOMINIO.md 247-265). Es un catalogo GLOBAL: no tiene
 * tenantId. El seed lo materializa en la tabla `permissions`.
 *
 * NO confundir con Feature (disponibilidad comercial de una funcionalidad):
 * docs/03 865-901.
 *
 * Inconsistencias de la documentacion que NO se incluyen aqui a proposito:
 *   - `roles.manage`   (docs/03 352, 395) no existe en el catalogo formal
 *     de docs/03 611-618; se interpreta como abreviatura de "administrar roles".
 *   - `products.delete` (docs/03 337) no existe en docs/03 477-487 y es
 *     coherente con la politica de no borrado fisico (docs/04 1416-1445).
 *   - El permiso para exceder limite de credito (RF-113) no tiene codigo
 *     definido en la documentacion; creditos esta fuera de esta fase.
 */

/** Modulos de permisos, en el orden de docs/03. */
export const PERMISSION_MODULES = [
  'products',
  'inventory',
  'purchases',
  'sales',
  'customers',
  'suppliers',
  'credits',
  'cash',
  'reports',
  'users',
  'roles',
  'tenant.settings',
  'audit',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export interface PermissionDefinition {
  code: string;
  module: PermissionModule;
  description: string;
}

/** docs/03 477-487 */
const PRODUCTS: PermissionDefinition[] = [
  { code: 'products.read', module: 'products', description: 'Consultar productos' },
  { code: 'products.create', module: 'products', description: 'Crear productos' },
  { code: 'products.update', module: 'products', description: 'Editar productos' },
  { code: 'products.activate', module: 'products', description: 'Activar productos' },
  { code: 'products.deactivate', module: 'products', description: 'Desactivar productos' },
  { code: 'products.manage_units', module: 'products', description: 'Administrar unidades' },
  {
    code: 'products.manage_presentations',
    module: 'products',
    description: 'Administrar presentaciones',
  },
  { code: 'products.change_price', module: 'products', description: 'Modificar precios' },
  { code: 'products.change_cost', module: 'products', description: 'Modificar costos' },
];

/** docs/03 493-499 */
const INVENTORY: PermissionDefinition[] = [
  { code: 'inventory.read', module: 'inventory', description: 'Consultar existencias' },
  { code: 'inventory.kardex', module: 'inventory', description: 'Consultar kardex' },
  { code: 'inventory.adjust', module: 'inventory', description: 'Ajustar inventario' },
  {
    code: 'inventory.adjust_approve',
    module: 'inventory',
    description: 'Aprobar ajustes de inventario',
  },
  { code: 'inventory.export', module: 'inventory', description: 'Exportar inventario' },
];

/** docs/03 509-515 */
const PURCHASES: PermissionDefinition[] = [
  { code: 'purchases.read', module: 'purchases', description: 'Consultar compras' },
  { code: 'purchases.create', module: 'purchases', description: 'Crear compras' },
  { code: 'purchases.update', module: 'purchases', description: 'Editar compras en borrador' },
  { code: 'purchases.complete', module: 'purchases', description: 'Completar compras' },
  { code: 'purchases.cancel', module: 'purchases', description: 'Cancelar compras' },
];

/** docs/03 521-527 */
const SALES: PermissionDefinition[] = [
  { code: 'sales.read', module: 'sales', description: 'Consultar ventas' },
  { code: 'sales.create', module: 'sales', description: 'Crear ventas' },
  { code: 'sales.cancel', module: 'sales', description: 'Cancelar ventas' },
  { code: 'sales.refund', module: 'sales', description: 'Procesar devoluciones' },
  { code: 'sales.export', module: 'sales', description: 'Exportar ventas' },
];

/** docs/03 533-538 */
const CUSTOMERS: PermissionDefinition[] = [
  { code: 'customers.read', module: 'customers', description: 'Consultar clientes' },
  { code: 'customers.create', module: 'customers', description: 'Crear clientes' },
  { code: 'customers.update', module: 'customers', description: 'Editar clientes' },
  { code: 'customers.deactivate', module: 'customers', description: 'Desactivar clientes' },
];

/** docs/03 544-549 */
const SUPPLIERS: PermissionDefinition[] = [
  { code: 'suppliers.read', module: 'suppliers', description: 'Consultar proveedores' },
  { code: 'suppliers.create', module: 'suppliers', description: 'Crear proveedores' },
  { code: 'suppliers.update', module: 'suppliers', description: 'Editar proveedores' },
  { code: 'suppliers.deactivate', module: 'suppliers', description: 'Desactivar proveedores' },
];

/** docs/03 555-562 */
const CREDITS: PermissionDefinition[] = [
  { code: 'credits.read', module: 'credits', description: 'Consultar cuentas de credito' },
  { code: 'credits.create', module: 'credits', description: 'Crear cuentas de credito' },
  { code: 'credits.collect', module: 'credits', description: 'Registrar abonos' },
  { code: 'credits.adjust', module: 'credits', description: 'Ajustar creditos' },
  { code: 'credits.change_limit', module: 'credits', description: 'Cambiar limite de credito' },
  { code: 'credits.export', module: 'credits', description: 'Exportar creditos' },
];

/** docs/03 568-577 */
const CASH: PermissionDefinition[] = [
  { code: 'cash.read', module: 'cash', description: 'Consultar caja' },
  { code: 'cash.open', module: 'cash', description: 'Abrir caja' },
  { code: 'cash.close', module: 'cash', description: 'Cerrar caja' },
  { code: 'cash.income', module: 'cash', description: 'Registrar ingresos de caja' },
  { code: 'cash.expense', module: 'cash', description: 'Registrar gastos de caja' },
  { code: 'cash.withdraw', module: 'cash', description: 'Registrar retiros de caja' },
  { code: 'cash.adjust', module: 'cash', description: 'Ajustar caja' },
  { code: 'cash.export', module: 'cash', description: 'Exportar movimientos de caja' },
];

/** docs/03 583-592 */
const REPORTS: PermissionDefinition[] = [
  { code: 'reports.read', module: 'reports', description: 'Consultar reportes' },
  { code: 'reports.sales', module: 'reports', description: 'Reportes de ventas' },
  { code: 'reports.purchases', module: 'reports', description: 'Reportes de compras' },
  { code: 'reports.inventory', module: 'reports', description: 'Reportes de inventario' },
  { code: 'reports.cash', module: 'reports', description: 'Reportes de caja' },
  { code: 'reports.credits', module: 'reports', description: 'Reportes de creditos' },
  { code: 'reports.profit', module: 'reports', description: 'Reportes de utilidad' },
  { code: 'reports.advanced', module: 'reports', description: 'Reportes avanzados' },
];

/** docs/03 598-605 */
const USERS: PermissionDefinition[] = [
  { code: 'users.read', module: 'users', description: 'Consultar usuarios' },
  { code: 'users.create', module: 'users', description: 'Crear usuarios' },
  { code: 'users.update', module: 'users', description: 'Editar usuarios' },
  { code: 'users.activate', module: 'users', description: 'Activar usuarios' },
  { code: 'users.deactivate', module: 'users', description: 'Desactivar usuarios' },
  { code: 'users.reset_access', module: 'users', description: 'Restablecer acceso de usuarios' },
];

/** docs/03 611-618 */
const ROLES: PermissionDefinition[] = [
  { code: 'roles.read', module: 'roles', description: 'Consultar roles' },
  { code: 'roles.create', module: 'roles', description: 'Crear roles' },
  { code: 'roles.update', module: 'roles', description: 'Editar roles' },
  { code: 'roles.delete', module: 'roles', description: 'Eliminar roles' },
  { code: 'roles.assign', module: 'roles', description: 'Asignar roles a membresias' },
  {
    code: 'roles.manage_permissions',
    module: 'roles',
    description: 'Modificar permisos de un rol',
  },
];

/** docs/03 624-627 */
const TENANT_SETTINGS: PermissionDefinition[] = [
  {
    code: 'tenant.settings.read',
    module: 'tenant.settings',
    description: 'Consultar configuracion del tenant',
  },
  {
    code: 'tenant.settings.update',
    module: 'tenant.settings',
    description: 'Modificar configuracion del tenant',
  },
];

/** docs/03 633-636 */
const AUDIT: PermissionDefinition[] = [
  { code: 'audit.read', module: 'audit', description: 'Consultar auditoria' },
  { code: 'audit.export', module: 'audit', description: 'Exportar auditoria' },
];

/** Catalogo completo: 70 permisos (docs/03 475-636). */
export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [
  ...PRODUCTS,
  ...INVENTORY,
  ...PURCHASES,
  ...SALES,
  ...CUSTOMERS,
  ...SUPPLIERS,
  ...CREDITS,
  ...CASH,
  ...REPORTS,
  ...USERS,
  ...ROLES,
  ...TENANT_SETTINGS,
  ...AUDIT,
];

/** Todos los codigos de permiso del catalogo. */
export const PERMISSION_CODES: readonly string[] = PERMISSION_CATALOG.map((p) => p.code);

/** Set para lookups O(1) desde tests y validaciones. */
export const PERMISSION_CODE_SET: ReadonlySet<string> = new Set(PERMISSION_CODES);
