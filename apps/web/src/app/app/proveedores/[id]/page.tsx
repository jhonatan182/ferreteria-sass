'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useHasPermission } from '@/lib/permissions';
import { suppliersApi, type Supplier } from '@/lib/suppliers';

import { Field } from '../../productos/ui';

/** Detalle y edición de un proveedor (RF-071 / RF-072). */
export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canUpdate = useHasPermission('suppliers.update');
  const canDeactivate = useHasPermission('suppliers.deactivate');

  const [data, setData] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [identification, setIdentification] = useState('');
  const [phone, setPhone] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [address, setAddress] = useState('');

  const fill = useCallback((s: Supplier) => {
    setData(s);
    setName(s.name);
    setIdentification(s.identification ?? '');
    setPhone(s.phone ?? '');
    setEmailValue(s.email ?? '');
    setAddress(s.address ?? '');
  }, []);

  const load = useCallback(async () => {
    try {
      fill(await suppliersApi.get(id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cargar el proveedor.');
    } finally {
      setLoading(false);
    }
  }, [id, fill]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void load();
  }, [load]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      fill(
        await suppliersApi.update(id, {
          name: name.trim(),
          identification: identification.trim() || null,
          phone: phone.trim() || null,
          email: emailValue.trim() || null,
          address: address.trim() || null,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive() {
    if (!data) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      fill(await suppliersApi.setActive(id, !data.isActive));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cambiar el estado.');
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
        <p className="text-sm text-destructive">{error ?? 'Proveedor no encontrado.'}</p>
        <Link href="/app/proveedores" className="text-sm underline">
          Volver a proveedores
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs ${
            data.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {data.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <form onSubmit={onSave} className="space-y-4 rounded-lg border p-6">
        <Field label="Nombre" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            disabled={!canUpdate}
          />
        </Field>
        <Field label="Identificación">
          <Input
            value={identification}
            onChange={(e) => setIdentification(e.target.value)}
            maxLength={60}
            disabled={!canUpdate}
          />
        </Field>
        <Field label="Teléfono">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            disabled={!canUpdate}
          />
        </Field>
        <Field label="Correo">
          <Input
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            maxLength={200}
            disabled={!canUpdate}
          />
        </Field>
        <Field label="Dirección">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={500}
            disabled={!canUpdate}
          />
        </Field>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canUpdate ? (
            <Button type="submit" size="sm" disabled={busy || !name.trim()}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          ) : null}
          {canDeactivate ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onToggleActive}
            >
              {data.isActive ? 'Desactivar' : 'Reactivar'}
            </Button>
          ) : null}
          <Button asChild type="button" size="sm" variant="ghost">
            <Link href="/app/proveedores">Volver</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
