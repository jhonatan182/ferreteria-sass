'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { customersApi, type Customer } from '@/lib/customers';
import { useHasPermission } from '@/lib/permissions';
import {
  SALE_STATUS_LABELS,
  salesApi,
  type SaleListItem,
  type SaleStatus,
} from '@/lib/sales';

const PAGE_SIZE = 20;
type StatusFilter = SaleStatus | 'all';

/** Listado de ventas. Paginación, rango de fechas, cliente, estado, documento. */
export default function SalesPage() {
  const canCreate = useHasPermission('sales.create');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [customerId, setCustomerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<SaleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await customersApi.list({ status: 'all', pageSize: 100 });
        setCustomers(res.items);
      } catch {
        /* el filtro de cliente es opcional */
      }
    })();
  }, []);

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
      const res = await salesApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: debounced || undefined,
        status: status === 'all' ? undefined : status,
        customerId: customerId || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudieron cargar las ventas.');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, status, customerId, from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y ante cambios de filtro
    void load();
  }, [load]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Ventas</h1>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href="/app/ventas/nueva">Nueva venta</Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por documento"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setPage(1);
          }}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="COMPLETED">Completada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
        <select
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Todos los clientes</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        />
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
              <Th>Fecha</Th>
              <Th>Documento</Th>
              <Th>Cliente</Th>
              <Th className="text-right">Items</Th>
              <Th className="text-right">Total</Th>
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
              items.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <Td>{new Date(s.saleDate).toLocaleDateString()}</Td>
                  <Td>
                    <Link href={`/app/ventas/${s.id}`} className="font-medium hover:underline">
                      {s.documentNumber ?? 'Sin documento'}
                    </Link>
                  </Td>
                  <Td>{s.customerName}</Td>
                  <Td className="text-right">{s.itemCount}</Td>
                  <Td className="text-right tabular-nums">{s.total}</Td>
                  <Td>
                    <StatusChip status={s.status} />
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} venta(s)</span>
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

export function StatusChip({ status }: { status: SaleStatus }) {
  const tone =
    status === 'COMPLETED'
      ? 'bg-primary/10 text-primary'
      : status === 'CANCELLED'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${tone}`}>
      {SALE_STATUS_LABELS[status]}
    </span>
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
