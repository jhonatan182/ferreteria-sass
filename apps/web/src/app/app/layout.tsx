'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

/**
 * Layout de la zona autenticada. Centraliza la guardia de sesion (antes
 * duplicada en cada pagina) y la navegacion. Es solo UX: el backend sigue
 * siendo la autoridad de acceso (docs/07 556-569).
 */
const NAV = [
  { href: '/app', label: 'Inicio' },
  { href: '/app/productos', label: 'Productos' },
  { href: '/app/inventario', label: 'Inventario' },
  { href: '/app/proveedores', label: 'Proveedores' },
  { href: '/app/compras', label: 'Compras' },
  { href: '/app/clientes', label: 'Clientes' },
  { href: '/app/ventas', label: 'Ventas' },
  { href: '/app/catalogos', label: 'Catalogos' },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  const activeMembership = me.memberships.find((m) => m.tenantId === me.activeTenantId);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {activeMembership?.tenantName ?? '—'} · {activeMembership?.roleName ?? '—'}
          </span>
          <Button variant="outline" size="sm" onClick={onLogout}>
            Cerrar sesión
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
