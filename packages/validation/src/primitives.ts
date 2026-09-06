import { z } from 'zod';

/** UUID interno. Ver docs/07-ARQUITECTURA-TECNICA.md seccion 10 (IDs = UUID). */
export const uuidSchema = z.uuid();

/**
 * Patrones decimales compartidos. Fuente unica para los esquemas zod (frontend)
 * y para los DTOs de class-validator del backend (`@Matches(...)`), de modo que
 * la forma aceptada en la API sea identica en ambos lados.
 *
 * El dinero y las cantidades viajan como CADENA, nunca `number`
 * (AGENTS.md 11-12, docs/07 12-13).
 */
/** Dinero con signo, hasta 4 decimales (p. ej. costo promedio ponderado). */
export const MONEY_PATTERN = /^-?\d{1,15}(\.\d{1,4})?$/;
/** Dinero no negativo (precios de venta). */
export const NON_NEGATIVE_MONEY_PATTERN = /^\d{1,15}(\.\d{1,4})?$/;
/** Cantidad decimal (fracciones permitidas), hasta 4 decimales. */
export const QUANTITY_PATTERN = /^\d{1,15}(\.\d{1,4})?$/;
/** Factor de conversion hacia la unidad base, hasta 6 decimales (docs/04 604). */
export const CONVERSION_FACTOR_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;

/**
 * Dinero: cadena decimal, nunca `number`.
 * AGENTS.md seccion 11 y docs/07 seccion 12: prohibido `float` para dinero.
 * Acepta hasta 4 decimales (p. ej. costo promedio ponderado).
 */
export const moneySchema = z.string().regex(MONEY_PATTERN, 'Monto decimal invalido');

/**
 * Cantidad: cadena decimal positiva.
 * AGENTS.md seccion 12: la ferreteria puede vender fracciones; no asumir enteros.
 */
export const quantitySchema = z
  .string()
  .regex(QUANTITY_PATTERN, 'Cantidad decimal invalida')
  .refine((v) => Number(v) > 0, 'La cantidad debe ser mayor que cero');
