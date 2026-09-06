import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';

import { DEFAULT_BCRYPT_COST } from './auth.constants.js';

/**
 * Hash y verificacion de contrasenas (docs/07 160 "hash seguro de contrasena").
 *
 * bcrypt (bcryptjs, JS puro — sin binarios nativos, encaja con el build ESM).
 * Coste 12. Nunca se guarda ni se registra la contrasena en claro
 * (docs/07 537-552).
 */
@Injectable()
export class PasswordService {
  /** Hash bcrypt de coste fijo, usado para igualar el tiempo de respuesta
   * cuando el usuario no existe o no tiene credencial (anti timing oracle). */
  private readonly dummyHash: string;
  private readonly cost: number;

  constructor(config: ConfigService) {
    this.cost = Number(config.get('BCRYPT_COST')) || DEFAULT_BCRYPT_COST;
    this.dummyHash = bcrypt.hashSync('::timing-equalizer::', this.cost);
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost);
  }

  /**
   * Compara `plain` contra `hash`. Si `hash` es `null`/`undefined` igualmente
   * consume el tiempo de un `compare` real y devuelve `false`.
   */
  async verify(plain: string, hash: string | null | undefined): Promise<boolean> {
    if (!hash) {
      await bcrypt.compare(plain, this.dummyHash);
      return false;
    }
    return bcrypt.compare(plain, hash);
  }
}
