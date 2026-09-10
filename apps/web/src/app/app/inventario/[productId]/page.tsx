'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { inventoryApi, type ProductInventory } from '@/lib/inventory';
import { useHasPermission } from '@/lib/permissions';

import { Field, StatusBadge } from '../../productos/ui';

/** Existencia y costo promedio de un producto (RF-060 / RF-132). */
export default function ProductInventoryPage() {
  const { productId } = useParams<{ productId: string }>();
  const canAdjust = useHasPermission('inventory.adjust');
  const canChangeCost = useHasPermission('products.change_cost');

  const [data, setData] = useState<ProductInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await inventoryApi.getProduct(productId));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error ?? 'Producto no encontrado.'}</p>
        <Link href="/app/inventario" className="text-sm underline">
          Volver a inventario
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{data.internalCode}</p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-6 text-sm">
        <div>
          <dt className="text-muted-foreground">Existencia actual</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {data.quantity} <span className="text-sm font-normal">{data.baseUnitCode}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Costo promedio</dt>
          <dd className="text-2xl font-semibold tabular-nums">{data.averageCost}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Valor aproximado</dt>
          <dd className="font-medium tabular-nums">{data.inventoryValue}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Última actualización</dt>
          <dd>{data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '—'}</dd>
        </div>
      </dl>

      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/inventario/${productId}/kardex`}>Ver kardex</Link>
        </Button>
        {canAdjust ? (
          <Button asChild size="sm">
            <Link href={`/app/inventario/${productId}/ajuste`}>Registrar ajuste</Link>
          </Button>
        ) : null}
      </div>

      {canChangeCost ? (
        <ChangeCostForm current={data.averageCost} productId={productId} onDone={load} />
      ) : null}
    </div>
  );
}

function ChangeCostForm({
  current,
  productId,
  onDone,
}: {
  current: string;
  productId: string;
  onDone: () => Promise<void>;
}) {
  const [value, setValue] = useState(current);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await inventoryApi.changeCost(productId, {
        averageCost: value.trim(),
        reason: reason.trim(),
      });
      setReason('');
      setSavedAt(Date.now());
      await onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cambiar el costo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-6">
      <div>
        <h2 className="text-sm font-semibold">Cambiar costo promedio</h2>
        <p className="text-xs text-muted-foreground">
          Fija el costo de valoración. No genera movimiento ni altera la existencia. Queda auditado.
        </p>
      </div>
      <Field label="Nuevo costo promedio" required>
        <Input value={value} onChange={(e) => setValue(e.target.value)} required />
      </Field>
      <Field label="Motivo" required>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
      </Field>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy || reason.trim().length < 3}>
          {busy ? 'Guardando…' : 'Guardar costo'}
        </Button>
        {savedAt ? <span className="text-xs text-muted-foreground">Guardado</span> : null}
      </div>
    </form>
  );
}
