/**
 * Plantillas de los roles de sistema (docs/03-ROLES-Y-PERMISOS.md 171-429).
 *
 * Fuente unica de la verdad para el mapeo rol -> permisos. La consumen:
 *   - el seed (prisma/seed.ts), al crear el tenant de desarrollo;
 *   - el futuro provisioning de tenants (crear tenant => crear sus 5 roles).
 *
 * Los roles son TENANT-OWNED (docs/04 214-243): estas son plantillas en
 * codigo, no filas globales. Cada tenant obtiene su propia copia con
 * isSystem = true.
 *
 * Sin herencia entre roles en V1 (docs/03 747-761): cada plantilla lista su
 * conjunto completo de permisos.
 */

import { PERMISSION_CODES } from './permissions.catalog.js';

export const SYSTEM_ROLE_NAMES = [
  'OWNER',
  'MANAGER',
  'CASHIER',
  'INVENTORY_MANAGER',
  'PURCHASES_MANAGER',
] as const;

export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

/**
 * OWNER — docs/03 189-263 (RP-009/RP-010).
 * La doc lo describe por capacidades a lo largo de los 9 modulos; la
 * enumeracion cubre el catalogo completo => los 70 permisos.
 */
const OWNER: readonly string[] = [...PERMISSION_CODES];

/**
 * MANAGER — docs/03 267-299 (RP-011/RP-012).
 * Definido POR NEGACION: "Por defecto no puede: administrar el tenant,
 * cambiar la propiedad del tenant, administrar suscripciones, administrar
 * configuracion SaaS, modificar permisos criticos de otros usuarios."
 * Traduccion: todo el catalogo MENOS administracion de usuarios, de roles y
 * la escritura de configuracion del tenant.
 */
const MANAGER_EXCLUDED: ReadonlySet<string> = new Set<string>([
  'users.read',
  'users.create',
  'users.update',
  'users.activate',
  'users.deactivate',
  'users.reset_access',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'roles.assign',
  'roles.manage_permissions',
  'tenant.settings.update',
]);
const MANAGER: readonly string[] = PERMISSION_CODES.filter((c) => !MANAGER_EXCLUDED.has(c));

/** CASHIER — docs/03 315-330 (RP-014). Lista literal, 10 permisos. */
const CASHIER: readonly string[] = [
  'products.read',
  'customers.read',
  'customers.create',
  'sales.read',
  'sales.create',
  'credits.read',
  'credits.collect',
  'cash.open',
  'cash.read',
  'cash.close',
];

/** INVENTORY_MANAGER — docs/03 371-381 (RP-016). Lista literal, 7 permisos. */
const INVENTORY_MANAGER: readonly string[] = [
  'products.read',
  'products.create',
  'products.update',
  'inventory.read',
  'inventory.adjust',
  'inventory.kardex',
  'purchases.read',
];

/**
 * PURCHASES_MANAGER — docs/03 400-429 (RP-018). Lista literal, 8 permisos.
 * `purchases.cancel` queda FUERA por defecto (docs/03 425-429: "puede
 * requerir un permiso adicional").
 */
const PURCHASES_MANAGER: readonly string[] = [
  'products.read',
  'suppliers.read',
  'suppliers.create',
  'suppliers.update',
  'purchases.read',
  'purchases.create',
  'purchases.update',
  'purchases.complete',
];

export interface RoleTemplate {
  name: SystemRoleName;
  description: string;
  permissions: readonly string[];
}

export const SYSTEM_ROLE_TEMPLATES: Record<SystemRoleName, RoleTemplate> = {
  OWNER: {
    name: 'OWNER',
    description: 'Propietario o responsable principal de la ferreteria',
    permissions: OWNER,
  },
  MANAGER: {
    name: 'MANAGER',
    description: 'Encargado general con amplias capacidades operativas',
    permissions: MANAGER,
  },
  CASHIER: {
    name: 'CASHIER',
    description: 'Ventas y operaciones de caja',
    permissions: CASHIER,
  },
  INVENTORY_MANAGER: {
    name: 'INVENTORY_MANAGER',
    description: 'Responsable de inventario y productos',
    permissions: INVENTORY_MANAGER,
  },
  PURCHASES_MANAGER: {
    name: 'PURCHASES_MANAGER',
    description: 'Responsable de compras y proveedores',
    permissions: PURCHASES_MANAGER,
  },
};

/** Lista ordenada de plantillas, util para iterar en el seed. */
export const SYSTEM_ROLE_TEMPLATE_LIST: readonly RoleTemplate[] = SYSTEM_ROLE_NAMES.map(
  (n) => SYSTEM_ROLE_TEMPLATES[n],
);
