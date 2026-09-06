'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useHasPermission } from '@/lib/permissions';
import {
  brandsApi,
  categoriesApi,
  type CatalogItem,
  productsApi,
  type Unit,
  unitsApi,
} from '@/lib/products';

import { Field, Select } from '../ui';

export default function NewProductPage() {
  const router = useRouter();
  const canCreate = useHasPermission('products.create');

  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [name, setName] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [baseUnitId, setBaseUnitId] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [c, b, u] = await Promise.all([
          categoriesApi.list(),
          brandsApi.list(),
          unitsApi.list(),
        ]);
        setCategories(c);
        setBrands(b);
        setUnits(u);
      } catch {
        setError('No se pudieron cargar los catálogos.');
      }
    })();
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const product = await productsApi.create({
        name: name.trim(),
        internalCode: internalCode.trim() || undefined,
        barcode: barcode.trim() || undefined,
        description: description.trim() || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        baseUnitId,
      });
      router.replace(`/app/productos/${product.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo crear el producto.');
      setSubmitting(false);
    }
  }

  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">No tienes permiso para crear productos.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Nuevo producto</h1>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-6">
        <Field label="Nombre" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </Field>

        <Field label="Código interno" hint="Se genera automáticamente si lo dejas vacío">
          <Input
            value={internalCode}
            onChange={(e) => setInternalCode(e.target.value)}
            placeholder="FER-000001"
            maxLength={60}
          />
        </Field>

        <Field label="Código de barras">
          <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} maxLength={64} />
        </Field>

        <Field label="Descripción">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={1000}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Unidad base" required>
          <Select value={baseUnitId} onChange={setBaseUnitId} required>
            <option value="">Selecciona…</option>
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

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting || !name.trim() || !baseUnitId}>
            {submitting ? 'Creando…' : 'Crear producto'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

