/**
 * Vistas de respuesta de la API de clientes. Hechas a mano: no se exponen
 * entidades Prisma crudas (precedente de `suppliers.views.ts`). El dinero sale
 * como CADENA (AGENTS.md 11-12).
 */

export interface CustomerView {
  id: string;
  name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditLimit: string;
  isGeneralCustomer: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomerRow {
  id: string;
  name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditLimit: { toString(): string };
  isGeneralCustomer: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toCustomerView(row: CustomerRow): CustomerView {
  return {
    id: row.id,
    name: row.name,
    identification: row.identification,
    phone: row.phone,
    email: row.email,
    address: row.address,
    creditLimit: row.creditLimit.toString(),
    isGeneralCustomer: row.isGeneralCustomer,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
