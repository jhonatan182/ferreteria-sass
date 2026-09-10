'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useHasPermission } from '@/lib/permissions';
import { suppliersApi, type Supplier } from '@/lib/suppliers';

import { Field } from '../productos/ui';

const PAGE_SIZE = 20;
type StatusFilter = 'active' | 'inactive' | 'all';

/**
 * Listado de proveedores (RF-070). La UI oculta acciones sin permiso; el backend
 * revalida cada operacion (docs/07 556-569).
 */
export default function SuppliersPage() {
  const canCreate = useHasPermission('suppliers.create');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [identification, setIdentification] = useState('');
  const [address, setAddress] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await suppliersApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: debounced || undefined,
        status,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'No se pudieron cargar los proveedores.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, debounced, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y ante cambios de filtro
    void load();
  }, [load]);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await suppliersApi.create({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: emailValue.trim() || undefined,
        identification: identification.trim() || undefined,
        address: address.trim() || undefined,
      });
      setName('');
      setPhone('');
      setEmailValue('');
      setIdentification('');
      setAddress('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo crear el proveedor.');
    } finally {
      setCreating(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Proveedores</h1>
        {canCreate ? (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cerrar' : 'Nuevo proveedor'}
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <form onSubmit={onCreate} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <Field label="Nombre" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
          </Field>
          <Field label="Identificación">
            <Input
              value={identification}
              onChange={(e) => setIdentification(e.target.value)}
              maxLength={60}
            />
          </Field>
          <Field label="Teléfono">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Correo">
            <Input
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              maxLength={200}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dirección">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={creating || !name.trim()}>
              {creating ? 'Guardando…' : 'Guardar proveedor'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nombre, identificación, teléfono o correo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setPage(1);
          }}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <Th>Nombre</Th>
              <Th>Identificación</Th>
              <Th>Teléfono</Th>
              <Th>Correo</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <Td>
                    <Link href={`/app/proveedores/${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                  </Td>
                  <Td>{s.identification ?? '—'}</Td>
                  <Td>{s.phone ?? '—'}</Td>
                  <Td>{s.email ?? '—'}</Td>
                  <Td>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        s.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {s.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} proveedor(es)</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span>
            {page} / {lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 font-medium text-muted-foreground ${className ?? ''}`}>{children}</th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className ?? ''}`}>{children}</td>;
}
