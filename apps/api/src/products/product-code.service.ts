import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';

interface SequenceRow {
  prefix: string;
  padding: number;
  value: number;
}

/**
 * Generacion del codigo interno del producto (docs/05 290-318, RN-006, D2).
 *
 * Se llama SIEMPRE con el cliente transaccional (`tx`) de la creacion del
 * producto y SOLO cuando el usuario no envio un codigo. El `UPDATE ... RETURNING`
 * toma un row lock sobre la fila del tenant: dos creaciones concurrentes se
 * serializan y obtienen valores distintos (AGENTS.md 21). Nunca `MAX(...) + 1`.
 */
@Injectable()
export class ProductCodeService {
  /** Devuelve el siguiente codigo formateado (`FER-000001`). */
  async next(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
    // El tenant puede no tener fila si fue provisionado antes de la Fase 4.
    await tx.$executeRaw`
      INSERT INTO tenant_product_sequences (tenant_id, updated_at)
      VALUES (${tenantId}::uuid, now())
      ON CONFLICT (tenant_id) DO NOTHING`;

    const rows = await tx.$queryRaw<SequenceRow[]>`
      UPDATE tenant_product_sequences
         SET next_value = next_value + 1, updated_at = now()
       WHERE tenant_id = ${tenantId}::uuid
      RETURNING prefix, padding, (next_value - 1) AS value`;

    const row = rows[0];
    if (!row) {
      throw new Error(`No se pudo obtener la secuencia de codigo del tenant ${tenantId}`);
    }
    return format(row);
  }
}

function format(row: SequenceRow): string {
  const value = Number(row.value);
  const padding = Number(row.padding);
  return `${row.prefix}-${String(value).padStart(padding, '0')}`;
}
