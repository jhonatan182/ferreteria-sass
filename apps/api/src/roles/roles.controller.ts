import { Controller, Get } from '@nestjs/common';
import type { RequestContext } from '@ferreteria/types';

import { CurrentContext, RequirePermissions } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface RoleView {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
}

/**
 * Lectura de roles del tenant. Primer endpoint protegido por permiso de la
 * plataforma; sirve de referencia para los modulos de dominio y de objetivo
 * para las pruebas de aislamiento entre tenants (docs/03 799-823).
 *
 * La query SIEMPRE incorpora `context.tenantId` (AGENTS.md 5, docs/07 131-150):
 * nunca se listan roles por id suelto.
 */
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('roles.read')
  async list(@CurrentContext() context: RequestContext): Promise<RoleView[]> {
    const roles = await this.prisma.role.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { name: 'asc' },
      include: { permissions: { select: { id: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissionCount: r.permissions.length,
    }));
  }
}
