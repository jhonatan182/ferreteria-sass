'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function SelectTenantPage() {
  const router = useRouter();
  const { me, loading, selectTenant } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!me) {
      router.replace('/login');
    } else if (me.context) {
      router.replace('/app');
    }
  }, [loading, me, router]);

  async function choose(tenantId: string) {
    setError(null);
    setBusy(tenantId);
    try {
      await selectTenant(tenantId);
      router.replace('/app');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo seleccionar el tenant.');
      setBusy(null);
    }
  }

  if (loading || !me) {
    return <main className="flex flex-1 items-center justify-center p-6">Cargando…</main>;
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Selecciona una ferretería</h1>
          <p className="text-sm text-muted-foreground">
            Tu usuario pertenece a varias. Elige con cuál trabajar.
          </p>
        </div>

        <ul className="space-y-2">
          {me.memberships.map((m) => (
            <li key={m.tenantId}>
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled={busy !== null}
                onClick={() => choose(m.tenantId)}
              >
                <span>{m.tenantName}</span>
                <span className="text-xs text-muted-foreground">
                  {m.roleName}
                  {m.tenantStatus !== 'ACTIVE' ? ` · ${m.tenantStatus}` : ''}
                </span>
              </Button>
            </li>
          ))}
        </ul>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
