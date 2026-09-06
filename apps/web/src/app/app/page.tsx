'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

/** Pantalla protegida mínima: confirma que el contexto autenticado se resuelve
 * en backend. No es el dashboard final. */
export default function AppPage() {
  const router = useRouter();
  const { me, loading, logout } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!me) {
      router.replace('/login');
    } else if (!me.context && me.requiresTenantSelection) {
      router.replace('/select-tenant');
    }
  }, [loading, me, router]);

  if (loading || !me) {
    return <main className="flex flex-1 items-center justify-center p-6">Cargando…</main>;
  }

  const activeMembership = me.memberships.find((m) => m.tenantId === me.activeTenantId);

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Sesión activa</h1>
        <Button variant="outline" size="sm" onClick={onLogout}>
          Cerrar sesión
        </Button>
      </header>

      <section className="space-y-1 rounded-lg border p-4 text-sm">
        <Row label="Usuario" value={`${me.user.name} · ${me.user.email}`} />
        <Row label="Platform Admin" value={me.user.isPlatformAdmin ? 'sí' : 'no'} />
        <Row
          label="Ferretería activa"
          value={activeMembership ? activeMembership.tenantName : '—'}
        />
        <Row label="Rol" value={activeMembership?.roleName ?? '—'} />
        <Row
          label="Permisos efectivos"
          value={me.context ? String(me.context.permissions.length) : '—'}
        />
        {me.contextIssue ? <Row label="Aviso" value={me.contextIssue} /> : null}
      </section>

      {me.memberships.length > 1 ? (
        <Button variant="ghost" size="sm" onClick={() => router.push('/select-tenant')}>
          Cambiar de ferretería
        </Button>
      ) : null}

      {me.context ? (
        <details className="rounded-lg border p-4 text-xs">
          <summary className="cursor-pointer font-medium">Contexto (RequestContext)</summary>
          <pre className="mt-2 overflow-x-auto">{JSON.stringify(me.context, null, 2)}</pre>
        </details>
      ) : null}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
