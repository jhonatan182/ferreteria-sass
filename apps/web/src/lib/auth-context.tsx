'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiRequestError } from './api';
import { authApi, type Me } from './auth';

interface AuthState {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  login: (email: string, password: string) => Promise<Me | null>;
  logout: () => Promise<void>;
  selectTenant: (tenantId: string) => Promise<Me | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<Me | null> => {
    try {
      const next = await authApi.me();
      setMe(next);
      return next;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setMe(null);
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial de la sesión al montar. `refresh` hace fetch antes de
    // cualquier setState, así que no hay render en cascada síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string): Promise<Me | null> => {
      await authApi.login(email, password);
      return refresh();
    },
    [refresh],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setMe(null);
    }
  }, []);

  const selectTenant = useCallback(
    async (tenantId: string): Promise<Me | null> => {
      await authApi.selectTenant(tenantId);
      return refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthState>(
    () => ({ me, loading, refresh, login, logout, selectTenant }),
    [me, loading, refresh, login, logout, selectTenant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
