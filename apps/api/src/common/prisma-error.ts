/**
 * Deteccion estructural de errores conocidos de Prisma.
 *
 * No se usa `instanceof Prisma.PrismaClientKnownRequestError`: con el generador
 * `prisma-client` + output propio, la clase importada puede no ser identica a la
 * que lanza el runtime cuando el error nace dentro de una transaccion
 * interactiva. Se comprueba la forma (`code` = "Pxxxx", `meta`).
 */
export interface PrismaKnownError {
  code: string;
  message?: string;
  meta?: Record<string, unknown>;
}

export function asPrismaKnownError(error: unknown): PrismaKnownError | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    /^P\d{4}$/.test((error as { code: string }).code)
  ) {
    return error as PrismaKnownError;
  }
  return null;
}

/** `true` si el error es una violacion de restriccion unica (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return asPrismaKnownError(error)?.code === 'P2002';
}

/**
 * Texto donde buscar el nombre de columna/indice violado en un P2002. Segun el
 * driver adapter, la info viaja en `meta.target` (array o string) o solo en el
 * mensaje ("Unique constraint failed on the fields: (`tenant_id`,`barcode`)").
 */
export function uniqueTarget(error: unknown): string {
  const known = asPrismaKnownError(error);
  if (!known) {
    return '';
  }
  // El driver adapter (pg) anida el nombre del indice en
  // meta.driverAdapterError.cause.constraint.index; otros builds lo ponen en
  // meta.target. Se serializa el meta y se busca dentro. NO se incluye el
  // mensaje: al autogenerar el codigo, el `data` renderizado en el mensaje
  // contiene "internalCode" aunque el indice violado sea otro.
  return JSON.stringify(known.meta ?? '');
}
