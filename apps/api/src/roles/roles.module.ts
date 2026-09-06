import { Module } from '@nestjs/common';

import { RolesController } from './roles.controller.js';

/**
 * Lectura de roles del tenant (fase de autorizacion base). La escritura de
 * roles/permisos llega en la fase de administracion de usuarios y roles.
 */
@Module({
  controllers: [RolesController],
})
export class RolesModule {}
