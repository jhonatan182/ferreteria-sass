/**
 * Cliente general de un tenant nuevo (Fase 7, RF-091, docs/04 seccion 48 D1).
 *
 * Decision docs/04 seccion 48 (D1): el "cliente general" es una FILA real de
 * `Customer` con `isGeneralCustomer = true`, no `customerId = null`. Asi RF-092
 * ("una venta a credito no puede asociarse al cliente general") es una regla
 * comprobable en el backend, y `Sale.customerId` puede ser NOT NULL.
 *
 * Esta plantilla la consumen:
 *   - el seed (prisma/seed.ts), al preparar el tenant de desarrollo;
 *   - el futuro provisioning de tenants (crear tenant => crear su cliente general).
 *
 * Uno solo por tenant: indice unico parcial `customer_one_general_per_tenant`
 * (a mano en la migracion). El cliente general no se desactiva ni recibe limite
 * de credito.
 */

export interface GeneralCustomerTemplate {
  name: string;
}

export const GENERAL_CUSTOMER_TEMPLATE: GeneralCustomerTemplate = {
  name: 'Cliente general',
};
