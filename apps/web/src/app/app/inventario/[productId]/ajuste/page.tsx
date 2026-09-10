'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { inventoryApi, type ProductInventory } from '@/lib/inventory';

import { Field } from '../../../productos/ui';

/**
 * Pantalla de ajuste manual (docs/05 626-681, RP-024).
 *
 * Se expresa como DIFERENCIA (+/-), NUNCA como "nuevo stock". Muestra la
 * existencia actual, el signo del ajuste, el resultado esperado calculado en
 * vivo y el motivo obligatorio. El backend revalida todo y rechaza el stock
 * negativo dentro de la transaccion.
 */
export default function AdjustmentPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<ProductInventory | null>(null);
  const [loading, setLoading] = useState(true);

  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProduct(await inventoryApi.getProduct(productId));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cargar el producto.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void load();
  }, [load]);

  const expected = useMemo(() => {
    if (!product) {
      return null;
    }
    const current = Number(product.quantity);
    const delta = Number(quantity);
    if (!quantity || Number.isNaN(delta) || delta <= 0) {
      return null;
    }
    return direction === 'IN' ? current + delta : current - delta;
  }, [product, quantity, direction]);

  const wouldGoNegative = expected !== null && expected < 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await inventoryApi.createAdjustment({
        productId,
        direction,
        quantity: quantity.trim(),
        reason: reason.trim(),
      });
      setDone(`Existencia: ${res.previousQuantity} → ${res.resultingQuantity}`);
      setQuantity('');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo registrar el ajuste.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!product) {
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
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ajuste de inventario</h1>
        <p className="text-sm text-muted-foreground">
          {product.name} · <span className="font-mono text-xs">{product.internalCode}</span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-6">
        <div className="flex items-baseline justify-between rounded-md bg-muted/40 px-4 py-3">
          <span className="text-sm text-muted-foreground">Existencia actual</span>
          <span className="text-xl font-semibold tabular-nums">
            {product.quantity} <span className="text-sm font-normal">{product.baseUnitCode}</span>
          </span>
        </div>

        <Field label="Dirección del ajuste" required>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection('IN')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                direction === 'IN'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              + Entrada
            </button>
            <button
              type="button"
              onClick={() => setDirection('OUT')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                direction === 'OUT'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              − Salida
            </button>
          </div>
        </Field>

        <Field
          label={`Cantidad a ${direction === 'IN' ? 'sumar' : 'restar'} (${product.baseUnitCode})`}
          required
        >
          <Input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
            placeholder="p. ej. 10 o 2.5"
            required
          />
        </Field>

        <div className="flex items-baseline justify-between rounded-md border border-dashed px-4 py-3">
          <span className="text-sm text-muted-foreground">Resultado esperado</span>
          <span
            className={`text-xl font-semibold tabular-nums ${wouldGoNegative ? 'text-destructive' : ''}`}
          >
            {expected === null ? '—' : expected}
          </span>
        </div>
        {wouldGoNegative ? (
          <p className="text-xs text-destructive">
            El ajuste dejaría la existencia negativa: será rechazado.
          </p>
        ) : null}

        <Field
          label="Motivo (obligatorio)"
          required
          hint="Conteo físico, producto dañado, pérdida, corrección…"
        >
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
          />
        </Field>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {done ? <p className="text-sm text-primary">Ajuste registrado. {done}</p> : null}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={
              busy ||
              !quantity ||
              Number(quantity) <= 0 ||
              reason.trim().length < 3 ||
              wouldGoNegative
            }
          >
            {busy ? 'Registrando…' : 'Registrar ajuste'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/app/inventario/${productId}`)}
          >
            Volver
          </Button>
        </div>
      </form>
    </div>
  );
}
