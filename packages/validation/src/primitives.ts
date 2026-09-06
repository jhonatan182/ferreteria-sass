import { z } from 'zod';

/** UUID interno. Ver docs/07-ARQUITECTURA-TECNICA.md seccion 10 (IDs = UUID). */
export const uuidSchema = z.uuid();

/**
 * Dinero: cadena decimal, nunca `number`.
 * AGENTS.md seccion 11 y docs/07 seccion 12: prohibido `float` para dinero.
 * Acepta hasta 4 decimales (p. ej. costo promedio ponderado).
 */
export const moneySchema = z.string().regex(/^-?\d{1,15}(\.\d{1,4})?$/, 'Monto decimal invalido');

/**
 * Cantidad: cadena decimal positiva.
 * AGENTS.md seccion 12: la ferreteria puede vender fracciones; no asumir enteros.
 */
export const quantitySchema = z
  .string()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, 'Cantidad decimal invalida')
  .refine((v) => Number(v) > 0, 'La cantidad debe ser mayor que cero');
