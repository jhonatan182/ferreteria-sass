'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { customersApi, type Customer } from '@/lib/customers';
import { useHasPermission } from '@/lib/permissions';
import { productsApi, type Presentation, type ProductListItem } from '@/lib/products';
import { salesApi, type SaleItemInput } from '@/lib/sales';

import { Field, Select } from '../../productos/ui';

interface Line {
  key: number;
  productId: string;
  productLabel: string;
  presentationId: string;
  quantity: string;
}

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Crear venta (RF-100). Nace en DRAFT: no afecta inventario, caja ni credito.
 * El precio mostrado sale de la presentación elegida, pero es PRELIMINAR: el
 * backend vuelve a resolverlo desde el `ProductPresentation` al completar
 * (RN-015, AGENTS.md 18) — nunca confía en lo que envía este formulario.
 */
export default function NewSalePage() {
  const router = useRouter();
  const canCreate = useHasPermission('sales.create');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

  const [presentationsByProduct, setPresentationsByProduct] = useState<
    Record<string, Presentation[]>
  >({});

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductListItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [general, list] = await Promise.all([
          customersApi.getGeneral(),
          customersApi.list({ status: 'active', pageSize: 100 }),
        ]);
        setCustomers(list.items);
        setCustomerId(general.id);
      } catch {
        setError('No se pudo cargar el cliente general.');
      }
    })();
  }, []);

  useEffect(() => {
    const term = search.trim();
    if (!term) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia resultados al vaciar la busqueda
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      void productsApi
        .list({ search: term, status: 'ACTIVE', pageSize: 10 })
        .then((res) => setSearchResults(res.items))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function loadPresentations(productId: string): Promise<Presentation[]> {
    if (presentationsByProduct[productId]) {
      return presentationsByProduct[productId];
    }
    const detail = await productsApi.get(productId);
    const active = detail.presentations.filter((pr) => pr.status === 'ACTIVE');
    setPresentationsByProduct((prev) => ({ ...prev, [productId]: active }));
    return active;
  }

  async function addProduct(product: ProductListItem) {
    const presentations = await loadPresentations(product.id);
    const defaultPresentation = presentations.find((p) => p.isDefault) ?? presentations[0];
    setLines((prev) => [
      ...prev,
      {
        key: Date.now(),
        productId: product.id,
        productLabel: `${product.internalCode} — ${product.name}`,
        presentationId: defaultPresentation?.id ?? '',
        quantity: '',
      },
    ]);
    setSearch('');
    setSearchResults([]);
  }

  function patchLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function priceOf(line: Line): number {
    const list = presentationsByProduct[line.productId] ?? [];
    const presentation = list.find((pr) => pr.id === line.presentationId);
    return presentation ? num(presentation.salePrice) : 0;
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const line of lines) {
      subtotal += num(line.quantity) * priceOf(line);
    }
    const total = subtotal - num(discount) + num(tax);
    return { subtotal, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- priceOf depende de presentationsByProduct, ya incluido via lines/discount/tax
  }, [lines, discount, tax, presentationsByProduct]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
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
      const body: Record<string, unknown> = { items };
      if (customerId) {
        body.customerId = customerId;
      }
      if (saleDate) {
        body.saleDate = saleDate;
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
      const sale = await salesApi.create(body);
      router.replace(`/app/ventas/${sale.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo crear la venta.');
      setSubmitting(false);
    }
  }

  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">No tienes permiso para crear ventas.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Nueva venta</h1>

      <form onSubmit={onSubmit} className="space-y-5 rounded-lg border p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente" hint="Por defecto, el cliente general.">
            <Select value={customerId} onChange={setCustomerId}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isGeneralCustomer ? ' (general)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha">
            <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-3">
          <span className="text-sm font-medium">Productos</span>
          <div className="relative">
            <Input
              placeholder="Buscar por código interno, código de barras o nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.trim() ? (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-sm">
                {searching ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
                ) : searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</p>
                ) : (
                  searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void addProduct(p)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{p.internalCode}</span>{' '}
                      {p.name}
                      {p.barcode ? <span className="text-muted-foreground"> · {p.barcode}</span> : null}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Busca un producto para agregarlo.</p>
          ) : (
            lines.map((line) => {
              const presentations = presentationsByProduct[line.productId] ?? [];
              const price = priceOf(line);
              return (
                <div key={line.key} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                  <div className="flex items-center text-sm sm:col-span-4">{line.productLabel}</div>
                  <div className="sm:col-span-3">
                    <Select
                      value={line.presentationId}
                      onChange={(v) => patchLine(line.key, { presentationId: v })}
                    >
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
                  <div className="flex items-center justify-end text-sm tabular-nums sm:col-span-2">
                    {(num(line.quantity) * price).toLocaleString()}
                  </div>
                  <div className="flex items-center justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="text-xs text-muted-foreground hover:text-destructive"
                      aria-label="Quitar línea"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-12">
                    Precio unitario (preliminar): L. {price.toLocaleString()}
                  </p>
                </div>
              );
            })
          )}
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
          <Button type="submit" disabled={submitting || lines.length === 0}>
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
