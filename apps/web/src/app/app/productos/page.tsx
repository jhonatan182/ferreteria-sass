'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useHasPermission } from '@/lib/permissions';
import { productsApi, type ProductListItem } from '@/lib/products';

import { StatusBadge } from './ui';

const PAGE_SIZE = 20;
type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'all';

export default function ProductsPage() {
  const canCreate = useHasPermission('products.create');
  const canActivate = useHasPermission('products.activate');
  const canDeactivate = useHasPermission('products.deactivate');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ACTIVE');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      const res = await productsApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: debounced || undefined,
        status,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y ante cambios de filtro
    void load();
  }, [load]);

  async function toggle(product: ProductListItem) {
    setBusyId(product.id);
    setError(null);
    try {
      if (product.status === 'ACTIVE') {
        await productsApi.deactivate(product.id);
      } else {
        await productsApi.activate(product.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setBusyId(null);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Productos</h1>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href="/app/productos/nuevo">Nuevo producto</Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por código, código de barras o nombre"
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
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
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
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Categoría</Th>
              <Th>Marca</Th>
              <Th>Unidad</Th>
              <Th className="text-right">Precio</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <Td className="font-mono text-xs">{p.internalCode}</Td>
                  <Td>
                    <Link href={`/app/productos/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {p.barcode ? (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{p.barcode}</span>
                    ) : null}
                  </Td>
                  <Td>{p.categoryName ?? '—'}</Td>
                  <Td>{p.brandName ?? '—'}</Td>
                  <Td>{p.baseUnitCode}</Td>
                  <Td className="text-right">{p.defaultPrice ?? '—'}</Td>
                  <Td>
                    <StatusBadge status={p.status} />
                  </Td>
                  <Td className="text-right">
                    {p.status === 'ACTIVE' && canDeactivate ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === p.id}
                        onClick={() => toggle(p)}
                      >
                        Desactivar
                      </Button>
                    ) : null}
                    {p.status === 'INACTIVE' && canActivate ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === p.id}
                        onClick={() => toggle(p)}
                      >
                        Activar
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} producto(s)</span>
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
  return <th className={`px-3 py-2 font-medium text-muted-foreground ${className ?? ''}`}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className ?? ''}`}>{children}</td>;
}
