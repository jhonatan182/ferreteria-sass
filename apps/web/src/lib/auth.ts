import type { RequestContext } from '@ferreteria/types';

import { apiFetch } from './api';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
}

export interface MembershipSummary {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  roleId: string;
  roleName: string;
}

export interface Me {
  user: PublicUser;
  memberships: MembershipSummary[];
  activeTenantId: string | null;
  context: RequestContext | null;
  contextIssue: string | null;
  requiresTenantSelection: boolean;
}

export interface LoginResponse {
  user: PublicUser;
  memberships: MembershipSummary[];
  activeTenantId: string | null;
  requiresTenantSelection: boolean;
}

export const authApi = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  logout: (): Promise<{ ok: true }> => apiFetch('/auth/logout', { method: 'POST' }),

  me: (): Promise<Me> => apiFetch('/auth/me'),

  selectTenant: (tenantId: string): Promise<{ context: RequestContext }> =>
    apiFetch('/auth/select-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    }),
};
