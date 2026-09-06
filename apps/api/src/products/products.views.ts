import type { Prisma } from '../generated/prisma/client.js';

/**
 * Vistas de respuesta de la API de productos. Hechas a mano (precedente de
 * `RolesController`): no se exponen entidades Prisma crudas. El dinero y los
 * factores salen como CADENA (AGENTS.md 11-12).
 */

export interface CatalogItemView {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface UnitView {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PresentationView {
  id: string;
  name: string;
  unitId: string;
  unitCode: string;
  conversionFactor: string;
  salePrice: string;
  isDefault: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ProductListItemView {
  id: string;
  internalCode: string;
  barcode: string | null;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  categoryName: string | null;
  brandName: string | null;
  baseUnitCode: string;
  defaultPrice: string | null;
}

export interface ProductDetailView {
  id: string;
  internalCode: string;
  barcode: string | null;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  categoryId: string | null;
  brandId: string | null;
  baseUnitId: string;
  baseUnitCode: string;
  createdAt: string;
  updatedAt: string;
  presentations: PresentationView[];
}

/** Prisma Decimal / null -> cadena / null. */
export function decimalToString(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toString();
}
