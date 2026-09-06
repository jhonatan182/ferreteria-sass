import { Injectable } from '@nestjs/common';

import { ERROR_CODES, ForbiddenException } from '../common/errors.js';
import type { TenantContext } from './auth.types.js';

/**
 * Servicio centralizado de features (docs/07 218-229, docs/03 865-901).
 *
 * En esta fase no hay modulos de dominio que consumirlo, pero la estructura
 * queda lista: los guards de tenant ya cargan las features del plan vigente en
 * `TenantContext.subscription.features`. Cuando llegue `credits`, `cash`, etc.,
 * su modulo llamara `featureService.assert(ctx, 'CREDITS')` antes del permiso
 * (orden de AGENTS.md 6: Feature -> Limit -> Permission).
 *
 * PROHIBIDO ramificar por nombre/codigo de plan (AGENTS.md 19): se decide por
 * feature.
 */
@Injectable()
export class FeatureService {
  has(ctx: TenantContext, featureCode: string): boolean {
    return ctx.subscription.features.has(featureCode);
  }

  assert(ctx: TenantContext, featureCode: string): void {
    if (!this.has(ctx, featureCode)) {
      throw new ForbiddenException(
        ERROR_CODES.FEATURE_NOT_AVAILABLE,
        `El plan del tenant no incluye la funcionalidad "${featureCode}".`,
        { feature: featureCode },
      );
    }
  }
}
