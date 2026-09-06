'use client';

import { useAuth } from './auth-context';

/**
 * Comprobacion de permiso en la UI. Es COSMETICA: oculta acciones que el
 * usuario no puede ejecutar para no confundir. La autoridad de acceso es
 * siempre el backend (docs/07 556-569, CLAUDE.md). El backend revalida cada
 * operacion aunque la UI muestre el boton.
 */
export function useHasPermission(code: string): boolean {
  const { me } = useAuth();
  return me?.context?.permissions.includes(code) ?? false;
}

export function usePermissions(): string[] {
  const { me } = useAuth();
  return me?.context?.permissions ?? [];
}
