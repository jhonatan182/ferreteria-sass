'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useHasPermission } from '@/lib/permissions';
import {
  brandsApi,
  type CatalogItem,
  categoriesApi,
  type Unit,
  unitsApi,
} from '@/lib/products';

import { StatusBadge } from '../productos/ui';

export default function CatalogsPage() {
  const canCreate = useHasPermission('products.create');
  const canUpdate = useHasPermission('products.update');
  const canManageUnits = useHasPermission('products.manage_units');

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Catálogos</h1>

      <NamedCatalog
        title="Categorías"
        api={categoriesApi}
        canCreate={canCreate}
        canToggle={canUpdate}
      />
      <NamedCatalog title="Marcas" api={brandsApi} canCreate={canCreate} canToggle={canUpdate} />
      <Units canManage={canManageUnits} />
    </div>
  );
}

interface NamedApi {
  list: (includeInactive?: boolean) => Promise<CatalogItem[]>;
  create: (data: { name: string; description?: string }) => Promise<CatalogItem>;
  setStatus: (id: string, active: boolean) => Promise<CatalogItem>;
}

function NamedCatalog({
  title,
  api,
  canCreate,
  canToggle,
}: {
  title: string;
  api: NamedApi;
  canCreate: boolean;
  canToggle: boolean;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.list(true));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : `No se pudo cargar ${title}.`);
    }
  }, [api, title]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del catalogo
    void load();
  }, [load]);

  async function op(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'La operación falló.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="divide-y text-sm">
        {items.length === 0 ? (
          <li className="py-2 text-muted-foreground">Sin registros.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2">
                {item.name}
                <StatusBadge status={item.status} />
              </span>
              {canToggle ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => op(() => api.setStatus(item.id, item.status !== 'ACTIVE'))}
                >
                  {item.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {canCreate ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await op(() => api.create({ name: name.trim() }));
            setName('');
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Nueva ${title.toLowerCase().replace(/s$/, '')}`}
            className="max-w-xs"
            required
          />
          <Button type="submit" size="sm" disabled={busy || !name.trim()}>
            Añadir
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function Units({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Unit[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await unitsApi.list(true));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudieron cargar las unidades.');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del catalogo
    void load();
  }, [load]);

  async function op(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'La operación falló.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-6">
      <h2 className="text-sm font-semibold">Unidades de medida</h2>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="divide-y text-sm">
        {items.map((u) => (
          <li key={u.id} className="flex items-center justify-between py-2">
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">{u.code}</span> {u.name}
              {u.symbol ? <span className="text-muted-foreground">({u.symbol})</span> : null}
              <StatusBadge status={u.status} />
            </span>
            {canManage ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => op(() => unitsApi.setStatus(u.id, u.status !== 'ACTIVE'))}
              >
                {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await op(() =>
              unitsApi.create({
                code: code.trim().toUpperCase(),
                name: name.trim(),
                symbol: symbol.trim() || undefined,
              }),
            );
            setCode('');
            setName('');
            setSymbol('');
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CÓDIGO"
            className="w-32"
            required
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            className="w-40"
            required
          />
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Símbolo"
            className="w-24"
          />
          <Button type="submit" size="sm" disabled={busy || !code.trim() || !name.trim()}>
            Añadir unidad
          </Button>
        </form>
      ) : null}
    </section>
  );
}
