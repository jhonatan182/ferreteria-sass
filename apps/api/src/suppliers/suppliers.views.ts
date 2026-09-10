/**
 * Vistas de respuesta de la API de proveedores. Hechas a mano: no se exponen
 * entidades Prisma crudas (precedente de `products.views.ts`).
 */

export interface SupplierView {
  id: string;
  name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SupplierRow {
  id: string;
  name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toSupplierView(row: SupplierRow): SupplierView {
  return {
    id: row.id,
    name: row.name,
    identification: row.identification,
    phone: row.phone,
    email: row.email,
    address: row.address,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
