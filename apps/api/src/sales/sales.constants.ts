import type { PaymentMethod } from '../generated/prisma/client.js';

/** Referencia estable del movimiento de inventario/credito originado por una venta. */
export const SALE_REFERENCE_TYPE = 'SALE';

/** Metodos de pago aceptados en V1 (RN-037). Coincide con el enum `PaymentMethod`. */
export const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'CREDIT'] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number] & PaymentMethod;
