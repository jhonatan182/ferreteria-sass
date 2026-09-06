import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@ferreteria/types';

import { Prisma } from '../generated/prisma/client.js';
import type { AuditAction } from './audit-actions.js';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId: string;
  /** Informacion relevante de la operacion (RN-076). Para cambios: valor previo y nuevo. */
  metadata?: Record<string, unknown>;
}

/**
 * Escritura de auditoria operativa (docs/04 1278-1315, RN-076, RF-140).
 *
 * SIEMPRE se llama con el cliente transaccional (`tx`) de la operacion que se
 * audita: si la operacion hace rollback, el registro de auditoria tambien
 * (docs/05 1782-1810). Nunca se escribe auditoria fuera de la transaccion.
 *
 * Append-only: este servicio solo crea. No hay update ni delete de AuditLog
 * desde la aplicacion (docs/04 1313-1315).
 */
@Injectable()
export class AuditService {
  async record(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    entry: AuditEntry,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata ? (entry.metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}
