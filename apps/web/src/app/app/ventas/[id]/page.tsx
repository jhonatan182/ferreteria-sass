'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { customersApi, type Customer } from '@/lib/customers';
import { useHasPermission } from '@/lib/permissions';
import { productsApi, type Presentation, type ProductListItem } from '@/lib/products';
import {
  PAYMENT_METHOD_LABELS,
  salesApi,
  type PaymentMethod,
  type SaleDetail,
  type SaleItemInput,
} from '@/lib/sales';

import { Field, Select } from '../../productos/ui';
import { StatusChip } from '../page';

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'CREDIT'];

/**
 * Detalle de una venta + acciones de dominio (completar, cancelar) y edición
 * del borrador (docs/05 830-1010, RF-100..RF-107).
 */
export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canCreate = useHasPermission('sales.create'); // rige editar y completar (docs/05 900-910)
  const canCancel = useHasPermission('sales.cancel');

  const [data, setData] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await salesApi.get(id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cargar la venta.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void load();
  }, [load]);

  async function onComplete(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { method };
      if (reference.trim()) {
        body.reference = reference.trim();
      }
      setData(await salesApi.complete(id, body));
      setCompleting(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo completar la venta.');
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setData(await salesApi.cancel(id, cancelReason.trim()));
      setCancelReason('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cancelar la venta.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error ?? 'Venta no encontrada.'}</p>
        <Link href="/app/ventas" className="text-sm underline">
          Volver a ventas
        </Link>
      </div>
    );
  }

  const isDraft = data.status === 'DRAFT';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {data.documentNumber ?? 'Venta sin documento'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.customerName}
            {data.customerIsGeneral ? ' (general)' : ''} ·{' '}
            {new Date(data.saleDate).toLocaleDateString()}
          </p>
        </div>
        <StatusChip status={data.status} />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isDraft && editing && canCreate ? (
        <DraftEditor
          sale={data}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setData(updated);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <Th>Producto</Th>
                  <Th>Presentación</Th>
                  <Th className="text-right">Cantidad</Th>
                  <Th className="text-right">Base</Th>
                  <Th className="text-right">Precio unit.</Th>
                  <Th className="text-right">Subtotal</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <Td>{item.productName}</Td>
                    <Td>{item.presentationName ?? item.unitCode}</Td>
                    <Td className="text-right tabular-nums">{item.quantity}</Td>
                    <Td className="text-right tabular-nums">{item.baseQuantity}</Td>
                    <Td className="text-right tabular-nums">{item.unitPrice}</Td>
                    <Td className="text-right tabular-nums">{item.subtotal}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto w-56 space-y-1 text-sm">
            <Row label="Subtotal" value={data.subtotal} />
            <Row label="Descuento" value={`- ${data.discount}`} />
            <Row label="Impuesto" value={`+ ${data.tax}`} />
            <div className="flex justify-between border-t pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{data.total}</dd>
            </div>
          </dl>

          {data.payments.length > 0 ? (
            <div className="rounded-md border p-3 text-sm">
              <p className="mb-1 font-medium">Pagos</p>
              {data.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-muted-foreground">
                  <span>
                    {PAYMENT_METHOD_LABELS[p.method]}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <span className="tabular-nums">{p.amount}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      {data.notes ? (
        <p className="rounded-md border bg-muted/30 p-3 text-sm">{data.notes}</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          Creada por {data.createdByName ?? '—'} · {new Date(data.createdAt).toLocaleString()}
        </div>
        {data.completedAt ? (
          <div>
            Completada por {data.completedByName ?? '—'} ·{' '}
            {new Date(data.completedAt).toLocaleString()}
          </div>
        ) : null}
        {data.cancelledAt ? (
          <div className="col-span-2 text-destructive">
            Cancelada por {data.cancelledByName ?? '—'} ·{' '}
            {new Date(data.cancelledAt).toLocaleString()} — motivo: {data.cancellationReason}
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {isDraft && canCreate && !editing && !completing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Editar borrador
          </Button>
        ) : null}
        {isDraft && canCreate && !editing && !completing ? (
          <Button size="sm" onClick={() => setCompleting(true)}>
            Completar venta
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost">
          <Link href="/app/ventas">Volver</Link>
        </Button>
      </div>

      {isDraft && completing ? (
        <form onSubmit={onComplete} className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Completar venta</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Método de pago" required>
              <Select value={method} onChange={(v) => setMethod(v as PaymentMethod)} required>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Referencia" hint="Voucher, número de transferencia, etc. (opcional)">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
            </Field>
          </div>
          {method === 'CREDIT' ? (
            <p className="text-xs text-muted-foreground">
              Exige un cliente específico (no el general) y valida el límite de crédito disponible.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Completando…' : 'Confirmar'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCompleting(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {data.status === 'COMPLETED' && canCancel ? (
        <form onSubmit={onCancel} className="space-y-3 rounded-lg border border-destructive/30 p-4">
          <h2 className="text-sm font-semibold">Cancelar venta</h2>
          <p className="text-xs text-muted-foreground">
            Genera un movimiento compensatorio de inventario (y revierte el crédito si aplica). La
            venta no se elimina.
          </p>
          <Field label="Motivo" required>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              minLength={3}
              required
            />
          </Field>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={busy || cancelReason.trim().length < 3}
          >
            {busy ? 'Cancelando…' : 'Cancelar venta'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

interface EditLine {
  key: number;
  productId: string;
  presentationId: string;
  quantity: string;
}

function DraftEditor({
  sale,
  onCancel,
  onSaved,
}: {
  sale: SaleDetail;
  onCancel: () => void;
  onSaved: (updated: SaleDetail) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(sale.customerId);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [presentationsByProduct, setPresentationsByProduct] = useState<
    Record<string, Presentation[]>
  >({});
  const [lines, setLines] = useState<EditLine[]>(
    sale.items.map((item, index) => ({
      key: index,
      productId: item.productId,
      presentationId: item.presentationId ?? '',
      quantity: item.quantity,
    })),
  );
  const [discount, setDiscount] = useState(sale.discount);
  const [tax, setTax] = useState(sale.tax);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [c, p] = await Promise.all([
          customersApi.list({ status: 'active', pageSize: 100 }),
          productsApi.list({ status: 'ACTIVE', pageSize: 100 }),
        ]);
        setCustomers(c.items);
        setProducts(p.items);
      } catch {
        setError('No se pudieron cargar clientes o productos.');
      }
    })();
  }, []);

  async function loadPresentations(productId: string) {
    if (!productId || presentationsByProduct[productId]) {
      return;
    }
    try {
      const detail = await productsApi.get(productId);
      setPresentationsByProduct((prev) => ({
        ...prev,
        [productId]: detail.presentations.filter((pr) => pr.status === 'ACTIVE'),
      }));
    } catch {
      /* opcional */
    }
  }

  useEffect(() => {
    const uniqueProductIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
    for (const productId of uniqueProductIds) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga de presentaciones del borrador
      void loadPresentations(productId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  function patchLine(key: number, patch: Partial<EditLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function priceOf(line: EditLine): number {
    const list = presentationsByProduct[line.productId] ?? [];
    const presentation = list.find((pr) => pr.id === line.presentationId);
    return presentation ? num(presentation.salePrice) : 0;
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const line of lines) {
      subtotal += num(line.quantity) * priceOf(line);
    }
    return { subtotal, total: subtotal - num(discount) + num(tax) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- priceOf depende de presentationsByProduct
  }, [lines, discount, tax, presentationsByProduct]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const items: SaleItemInput[] = lines
        .filter((l) => l.productId && l.presentationId && l.quantity)
        .map((l) => ({
          productId: l.productId,
          presentationId: l.presentationId,
          quantity: l.quantity.trim(),
        }));
      if (items.length === 0) {
        throw new ApiRequestError(400, 'VALIDATION_ERROR', 'Agrega al menos una línea válida.');
      }
      const updated = await salesApi.update(sale.id, {
        customerId,
        items,
        discount: discount.trim() || '0',
        tax: tax.trim() || '0',
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo guardar el borrador.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-3 rounded-lg border p-4">
      <Field label="Cliente">
        <Select value={customerId} onChange={setCustomerId}>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isGeneralCustomer ? ' (general)' : ''}
            </option>
          ))}
        </Select>
      </Field>

      {lines.map((line) => {
        const presentations = presentationsByProduct[line.productId] ?? [];
        return (
          <div key={line.key} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <Select
                value={line.productId}
                onChange={(v) => {
                  patchLine(line.key, { productId: v, presentationId: '' });
                  void loadPresentations(v);
                }}
              >
                <option value="">Producto…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.internalCode} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-3">
              <Select
                value={line.presentationId}
                onChange={(v) => patchLine(line.key, { presentationId: v })}
              >
                <option value="">Presentación…</option>
                {presentations.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} (L. {pr.salePrice})
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Input
                placeholder="Cantidad"
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-end sm:col-span-2 text-sm tabular-nums">
              {(num(line.quantity) * priceOf(line)).toLocaleString()}
            </div>
            <div className="flex items-center justify-end sm:col-span-1">
              {lines.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  className="text-xs text-muted-foreground hover:text-destructive"
                  aria-label="Quitar línea"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          setLines((prev) => [
            ...prev,
            { key: Date.now(), productId: '', presentationId: '', quantity: '' },
          ])
        }
      >
        Agregar línea
      </Button>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Descuento">
          <Input
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </Field>
        <Field label="Impuesto">
          <Input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
        </Field>
      </div>

      <p className="text-right text-sm text-muted-foreground">
        Total preliminar: <span className="font-semibold">{totals.total.toLocaleString()}</span>
      </p>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar borrador'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Descartar cambios
        </Button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
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
