'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useHasPermission } from '@/lib/permissions';
import {
  brandsApi,
  categoriesApi,
  type CatalogItem,
  type ProductDetail,
  productsApi,
  type Unit,
  unitsApi,
} from '@/lib/products';

import { Field, Select, StatusBadge } from '../ui';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const canUpdate = useHasPermission('products.update');
  const canActivate = useHasPermission('products.activate');
  const canDeactivate = useHasPermission('products.deactivate');
  const canManagePresentations = useHasPermission('products.manage_presentations');
  const canChangePrice = useHasPermission('products.change_price');

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, c, b, u] = await Promise.all([
        productsApi.get(id),
        categoriesApi.list(),
        brandsApi.list(),
        unitsApi.list(),
      ]);
      setProduct(p);
      setCategories(c);
      setBrands(b);
      setUnits(u);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cargar el producto.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del detalle
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!product) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error ?? 'Producto no encontrado.'}</p>
        <Link href="/app/productos" className="text-sm underline">
          Volver a productos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{product.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{product.internalCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={product.status} />
          {product.status === 'ACTIVE' && canDeactivate ? (
            <StatusButton productId={product.id} activate={false} onDone={load} />
          ) : null}
          {product.status === 'INACTIVE' && canActivate ? (
            <StatusButton productId={product.id} activate onDone={load} />
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <EditForm
        product={product}
        categories={categories}
        brands={brands}
        units={units}
        disabled={!canUpdate}
        hasPresentations={product.presentations.length > 0}
        onSaved={load}
      />

      <Presentations
        product={product}
        units={units}
        canManage={canManagePresentations}
        canChangePrice={canChangePrice}
        onChanged={load}
      />
    </div>
  );
}

function StatusButton({
  productId,
  activate,
  onDone,
}: {
  productId: string;
  activate: boolean;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await (activate ? productsApi.activate(productId) : productsApi.deactivate(productId));
          await onDone();
        } finally {
          setBusy(false);
        }
      }}
    >
      {activate ? 'Activar' : 'Desactivar'}
    </Button>
  );
}

function EditForm({
  product,
  categories,
  brands,
  units,
  disabled,
  hasPresentations,
  onSaved,
}: {
  product: ProductDetail;
  categories: CatalogItem[];
  brands: CatalogItem[];
  units: Unit[];
  disabled: boolean;
  hasPresentations: boolean;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [barcode, setBarcode] = useState(product.barcode ?? '');
  const [description, setDescription] = useState(product.description ?? '');
  const [categoryId, setCategoryId] = useState(product.categoryId ?? '');
  const [brandId, setBrandId] = useState(product.brandId ?? '');
  const [baseUnitId, setBaseUnitId] = useState(product.baseUnitId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await productsApi.update(product.id, {
        name: name.trim(),
        barcode: barcode.trim() || null,
        description: description.trim() || null,
        categoryId: categoryId || null,
        brandId: brandId || null,
        ...(baseUnitId !== product.baseUnitId ? { baseUnitId } : {}),
      });
      setSavedAt(Date.now());
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-6">
      <h2 className="text-sm font-semibold">Datos del producto</h2>
      <Field label="Nombre" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} required />
      </Field>
      <Field label="Código de barras">
        <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} disabled={disabled} />
      </Field>
      <Field label="Descripción">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
          rows={2}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm disabled:opacity-50"
        />
      </Field>
      <Field
        label="Unidad base"
        hint={hasPresentations ? 'No editable: el producto ya tiene presentaciones' : undefined}
      >
        <Select value={baseUnitId} onChange={setBaseUnitId} >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Categoría">
        <Select value={categoryId} onChange={setCategoryId}>
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Marca">
        <Select value={brandId} onChange={setBrandId}>
          <option value="">Sin marca</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!disabled ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          {savedAt ? <span className="text-xs text-muted-foreground">Guardado</span> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Solo lectura: no tienes products.update.</p>
      )}
    </form>
  );
}

function Presentations({
  product,
  units,
  canManage,
  canChangePrice,
  onChanged,
}: {
  product: ProductDetail;
  units: Unit[];
  canManage: boolean;
  canChangePrice: boolean;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, marker: string) {
    setBusyId(marker);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'La operación falló.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-6">
      <h2 className="text-sm font-semibold">Presentaciones</h2>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="px-2 py-1 font-medium">Nombre</th>
              <th className="px-2 py-1 font-medium">Unidad</th>
              <th className="px-2 py-1 font-medium text-right">Factor</th>
              <th className="px-2 py-1 font-medium text-right">Precio</th>
              <th className="px-2 py-1 font-medium">Principal</th>
              <th className="px-2 py-1 font-medium">Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {product.presentations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                  Sin presentaciones.
                </td>
              </tr>
            ) : (
              product.presentations.map((p) => (
                <tr key={p.id} className="border-b last:border-0 align-top">
                  <td className="px-2 py-2">{p.name}</td>
                  <td className="px-2 py-2">{p.unitCode}</td>
                  <td className="px-2 py-2 text-right">{p.conversionFactor}</td>
                  <td className="px-2 py-2 text-right">
                    {canChangePrice ? (
                      <PriceEditor
                        current={p.salePrice}
                        onSave={(salePrice, reason) =>
                          run(
                            () => productsApi.changePrice(product.id, p.id, { salePrice, reason }),
                            `price-${p.id}`,
                          )
                        }
                        busy={busyId === `price-${p.id}`}
                      />
                    ) : (
                      p.salePrice
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {p.isDefault ? (
                      <span className="text-xs font-medium text-primary">Principal</span>
                    ) : canManage && p.status === 'ACTIVE' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === `def-${p.id}`}
                        onClick={() =>
                          run(
                            () => productsApi.setDefaultPresentation(product.id, p.id),
                            `def-${p.id}`,
                          )
                        }
                      >
                        Hacer principal
                      </Button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === `st-${p.id}`}
                        onClick={() =>
                          run(
                            () =>
                              productsApi.setPresentationStatus(
                                product.id,
                                p.id,
                                p.status !== 'ACTIVE',
                              ),
                            `st-${p.id}`,
                          )
                        }
                      >
                        {p.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <NewPresentation
          units={units}
          busy={busyId === 'new'}
          onCreate={(data) =>
            run(() => productsApi.createPresentation(product.id, data), 'new')
          }
        />
      ) : null}
    </section>
  );
}

function PriceEditor({
  current,
  onSave,
  busy,
}: {
  current: string;
  onSave: (salePrice: string, reason: string) => Promise<void>;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [reason, setReason] = useState('');

  if (!editing) {
    return (
      <button
        type="button"
        className="underline decoration-dotted"
        onClick={() => {
          setValue(current);
          setReason('');
          setEditing(true);
        }}
      >
        {current}
      </button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-28 text-right"
      />
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo"
        className="h-8 w-40 text-xs"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            await onSave(value.trim(), reason.trim());
            setEditing(false);
          }}
        >
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function NewPresentation({
  units,
  busy,
  onCreate,
}: {
  units: Unit[];
  busy: boolean;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [conversionFactor, setConversionFactor] = useState('1');
  const [salePrice, setSalePrice] = useState('0');
  const [isDefault, setIsDefault] = useState(false);

  return (
    <form
      className="grid gap-2 rounded-md border border-dashed p-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await onCreate({
          name: name.trim(),
          unitId,
          conversionFactor: conversionFactor.trim(),
          salePrice: salePrice.trim(),
          isDefault,
        });
        setName('');
        setConversionFactor('1');
        setSalePrice('0');
        setIsDefault(false);
      }}
    >
      <p className="sm:col-span-2 text-xs font-medium text-muted-foreground">Nueva presentación</p>
      <Input placeholder="Nombre (p. ej. Bolsa 50 lb)" value={name} onChange={(e) => setName(e.target.value)} required />
      <select
        value={unitId}
        onChange={(e) => setUnitId(e.target.value)}
        required
        className="h-9 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">Unidad…</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.code}
          </option>
        ))}
      </select>
      <Input
        placeholder="Factor de conversión"
        value={conversionFactor}
        onChange={(e) => setConversionFactor(e.target.value)}
        required
      />
      <Input
        placeholder="Precio de venta"
        value={salePrice}
        onChange={(e) => setSalePrice(e.target.value)}
        required
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Principal
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy || !name.trim() || !unitId}>
          Añadir presentación
        </Button>
      </div>
    </form>
  );
}
