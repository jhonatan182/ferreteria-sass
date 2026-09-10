'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import {
  inventoryApi,
  KARDEX_TYPE_LABELS,
  type KardexEntry,
  type ProductInventory,
} from '@/lib/inventory';

const PAGE_SIZE = 25;

/** Kardex de un producto (RF-062 / RF-133): cómo se llegó al saldo actual. */
export default function KardexPage() {
  const { productId } = useParams<{ productId: string }>();

  const [product, setProduct] = useState<ProductInventory | null>(null);
  const [items, setItems] = useState<KardexEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, res] = await Promise.all([
        inventoryApi.getProduct(productId),
        inventoryApi.kardex(productId, {
          page,
          pageSize: PAGE_SIZE,
          from: from || undefined,
          to: to || undefined,
          type: type || undefined,
        }),
      ]);
      setProduct(p);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cargar el kardex.');
    } finally {
      setLoading(false);
    }
  }, [productId, page, from, to, type]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y ante cambios de filtro
    void load();
  }, [load]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Kardex</h1>
        {product ? (
          <p className="text-sm text-muted-foreground">
            {product.name} · <span className="font-mono text-xs">{product.internalCode}</span> ·
            existencia {product.quantity} {product.baseUnitCode}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Desde
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="h-9"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Hasta
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="h-9"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Tipo
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="ml-0 block h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(KARDEX_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/inventario/${productId}`}>Volver</Link>
        </Button>
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
              <Th>Tipo</Th>
              <Th className="text-right">Entrada</Th>
              <Th className="text-right">Salida</Th>
              <Th className="text-right">Saldo</Th>
              <Th className="text-right">Costo unit.</Th>
              <Th>Usuario</Th>
              <Th>Documento</Th>
              <Th>Motivo</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  Sin movimientos.
                </td>
              </tr>
            ) : (
              items.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <Td className="whitespace-nowrap">{new Date(m.date).toLocaleString()}</Td>
                  <Td>{KARDEX_TYPE_LABELS[m.type] ?? m.type}</Td>
                  <Td className="text-right tabular-nums">{m.entrada === '0' ? '—' : m.entrada}</Td>
                  <Td className="text-right tabular-nums">{m.salida === '0' ? '—' : m.salida}</Td>
                  <Td className="text-right font-medium tabular-nums">{m.saldo}</Td>
                  <Td className="text-right tabular-nums">{m.unitCost ?? '—'}</Td>
                  <Td>{m.userName ?? '—'}</Td>
                  <Td className="text-xs text-muted-foreground">
                    {m.referenceType ? `${m.referenceType}` : '—'}
                  </Td>
                  <Td className="text-xs">{m.reason ?? '—'}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} movimiento(s)</span>
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
