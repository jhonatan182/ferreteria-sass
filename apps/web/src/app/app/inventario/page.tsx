'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { inventoryApi, type InventoryBalanceListItem } from '@/lib/inventory';
import { useHasPermission } from '@/lib/permissions';

import { StatusBadge } from '../productos/ui';

const PAGE_SIZE = 20;
type StockFilter = 'all' | 'with' | 'without';

/**
 * Consulta de existencias (RF-060). El listado esta guiado por los productos del
 * tenant activo: un producto sin movimientos aparece con existencia 0. La
 * existencia solo cambia mediante un ajuste u otra operacion de dominio.
 */
export default function InventoryPage() {
  const canAdjust = useHasPermission('inventory.adjust');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [stock, setStock] = useState<StockFilter>('all');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<InventoryBalanceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const res = await inventoryApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: debounced || undefined,
        stock,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, stock]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y ante cambios de filtro
    void load();
  }, [load]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Inventario</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por código, código de barras o nombre"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={stock}
          onChange={(e) => {
            setStock(e.target.value as StockFilter);
            setPage(1);
          }}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="all">Toda la existencia</option>
          <option value="with">Con existencia</option>
          <option value="without">Sin existencia</option>
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
              <Th>Unidad</Th>
              <Th className="text-right">Existencia</Th>
              <Th className="text-right">Costo promedio</Th>
              <Th className="text-right">Valor</Th>
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
              items.map((row) => (
                <tr key={row.productId} className="border-b last:border-0">
                  <Td className="font-mono text-xs">{row.internalCode}</Td>
                  <Td>
                    <Link
                      href={`/app/inventario/${row.productId}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                  </Td>
                  <Td>{row.baseUnitCode}</Td>
                  <Td className="text-right font-medium">{row.quantity}</Td>
                  <Td className="text-right">{row.averageCost}</Td>
                  <Td className="text-right">{row.inventoryValue}</Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                  <Td className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/inventario/${row.productId}/kardex`}>Kardex</Link>
                    </Button>
                    {canAdjust ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/app/inventario/${row.productId}/ajuste`}>Ajustar</Link>
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
  return (
    <th className={`px-3 py-2 font-medium text-muted-foreground ${className ?? ''}`}>{children}</th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className ?? ''}`}>{children}</td>;
}
