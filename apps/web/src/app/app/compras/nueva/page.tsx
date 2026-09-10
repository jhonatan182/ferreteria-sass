'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useHasPermission } from '@/lib/permissions';
import { purchasesApi, type PurchaseItemInput } from '@/lib/purchases';
import { productsApi, type Presentation, type ProductListItem } from '@/lib/products';
import { suppliersApi, type Supplier } from '@/lib/suppliers';

import { Field, Select } from '../../productos/ui';

interface Line {
  key: number;
  productId: string;
  presentationId: string;
  quantity: string;
  unitCost: string;
}

const emptyLine = (key: number): Line => ({
  key,
  productId: '',
  presentationId: '',
  quantity: '',
  unitCost: '',
});

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Crear compra (RF-080). Nace en DRAFT: no afecta inventario. Los totales que se
 * muestran son PRELIMINARES; el backend los recalcula (AGENTS.md 18).
 */
export default function NewPurchasePage() {
  const router = useRouter();
  const canCreate = useHasPermission('purchases.create');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [presentationsByProduct, setPresentationsByProduct] = useState<
    Record<string, Presentation[]>
  >({});

  const [supplierId, setSupplierId] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(0)]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [s, p] = await Promise.all([
          suppliersApi.list({ status: 'active', pageSize: 100 }),
          productsApi.list({ status: 'ACTIVE', pageSize: 100 }),
        ]);
        setSuppliers(s.items);
        setProducts(p.items);
      } catch {
        setError('No se pudieron cargar proveedores o productos.');
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
      /* la presentación es opcional */
    }
  }

  function patchLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const line of lines) {
      subtotal += num(line.quantity) * num(line.unitCost);
    }
    const total = subtotal - num(discount) + num(tax);
    return { subtotal, total };
  }, [lines, discount, tax]);

  function lineBaseQuantity(line: Line): number {
    const list = presentationsByProduct[line.productId] ?? [];
    const presentation = list.find((pr) => pr.id === line.presentationId);
    const factor = presentation ? num(presentation.conversionFactor) : 1;
    return num(line.quantity) * factor;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const items: PurchaseItemInput[] = lines
        .filter((l) => l.productId && l.quantity && l.unitCost)
        .map((l) => ({
          productId: l.productId,
          presentationId: l.presentationId || undefined,
          quantity: l.quantity.trim(),
          unitCost: l.unitCost.trim(),
        }));
      if (items.length === 0) {
        throw new ApiRequestError(400, 'VALIDATION_ERROR', 'Agrega al menos una línea válida.');
      }
      const body: Record<string, unknown> = { supplierId, items };
      if (documentNumber.trim()) {
        body.documentNumber = documentNumber.trim();
      }
      if (purchaseDate) {
        body.purchaseDate = purchaseDate;
      }
      if (discount.trim()) {
        body.discount = discount.trim();
      }
      if (tax.trim()) {
        body.tax = tax.trim();
      }
      if (notes.trim()) {
        body.notes = notes.trim();
      }
      const purchase = await purchasesApi.create(body);
      router.replace(`/app/compras/${purchase.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo crear la compra.');
      setSubmitting(false);
    }
  }

  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">No tienes permiso para crear compras.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Nueva compra</h1>

      <form onSubmit={onSubmit} className="space-y-5 rounded-lg border p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Proveedor" required>
            <Select value={supplierId} onChange={setSupplierId} required>
              <option value="">Selecciona…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Documento">
            <Input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              maxLength={60}
            />
          </Field>
          <Field label="Fecha">
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Líneas</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLines((prev) => [...prev, emptyLine(Date.now())])}
            >
              Agregar línea
            </Button>
          </div>

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
                    <option value="">Unidad base</option>
                    {presentations.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name} (×{pr.conversionFactor})
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
                <div className="sm:col-span-2">
                  <Input
                    placeholder="Costo unit."
                    inputMode="decimal"
                    value={line.unitCost}
                    onChange={(e) => patchLine(line.key, { unitCost: e.target.value })}
                  />
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
                <p className="text-xs text-muted-foreground sm:col-span-12">
                  Base: {lineBaseQuantity(line).toLocaleString()} · Subtotal:{' '}
                  {(num(line.quantity) * num(line.unitCost)).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="sm:col-span-2">
            <Field label="Notas">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </div>

        <dl className="flex justify-end gap-6 border-t pt-3 text-sm">
          <div className="text-right">
            <dt className="text-muted-foreground">Subtotal (preliminar)</dt>
            <dd className="tabular-nums">{totals.subtotal.toLocaleString()}</dd>
          </div>
          <div className="text-right">
            <dt className="text-muted-foreground">Total (preliminar)</dt>
            <dd className="text-lg font-semibold tabular-nums">{totals.total.toLocaleString()}</dd>
          </div>
        </dl>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting || !supplierId}>
            {submitting ? 'Creando…' : 'Crear borrador'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
