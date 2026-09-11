'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { customersApi, type Customer } from '@/lib/customers';
import { useHasPermission } from '@/lib/permissions';

import { Field } from '../productos/ui';

const PAGE_SIZE = 20;
type StatusFilter = 'active' | 'inactive' | 'all';

/**
 * Listado de clientes (RF-090). El cliente general (RF-091) aparece primero en
 * la lista y no puede desactivarse. La UI oculta acciones sin permiso; el
 * backend revalida cada operacion (docs/07 556-569).
 */
export default function CustomersPage() {
  const canCreate = useHasPermission('customers.create');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Customer[]>([]);
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
      const res = await customersApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: debounced || undefined,
        status,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudieron cargar los clientes.');
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
      await customersApi.create({
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
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo crear el cliente.');
    } finally {
      setCreating(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
        {canCreate ? (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cerrar' : 'Nuevo cliente'}
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
              {creating ? 'Guardando…' : 'Guardar cliente'}
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
              <Th className="text-right">Límite crédito</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <Td>
                    <Link href={`/app/clientes/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    {c.isGeneralCustomer ? (
                      <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        General
                      </span>
                    ) : null}
                  </Td>
                  <Td>{c.identification ?? '—'}</Td>
                  <Td>{c.phone ?? '—'}</Td>
                  <Td>{c.email ?? '—'}</Td>
                  <Td className="text-right tabular-nums">{c.creditLimit}</Td>
                  <Td>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        c.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} cliente(s)</span>
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
