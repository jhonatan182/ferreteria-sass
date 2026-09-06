'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

/** Inicio de la zona autenticada. La guardia de sesion vive en el layout. */
export default function AppPage() {
  const router = useRouter();
  const { me } = useAuth();

  if (!me) {
    return null;
  }

  const activeMembership = me.memberships.find((m) => m.tenantId === me.activeTenantId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Sesión activa</h1>

      <section className="space-y-1 rounded-lg border p-4 text-sm">
        <Row label="Usuario" value={`${me.user.name} · ${me.user.email}`} />
        <Row label="Platform Admin" value={me.user.isPlatformAdmin ? 'sí' : 'no'} />
        <Row label="Ferretería activa" value={activeMembership ? activeMembership.tenantName : '—'} />
        <Row label="Rol" value={activeMembership?.roleName ?? '—'} />
        <Row
          label="Permisos efectivos"
          value={me.context ? String(me.context.permissions.length) : '—'}
        />
        {me.contextIssue ? <Row label="Aviso" value={me.contextIssue} /> : null}
      </section>

      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href="/app/productos">Ir a productos</Link>
        </Button>
        {me.memberships.length > 1 ? (
          <Button variant="ghost" size="sm" onClick={() => router.push('/select-tenant')}>
            Cambiar de ferretería
          </Button>
        ) : null}
      </div>
    </div>
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
