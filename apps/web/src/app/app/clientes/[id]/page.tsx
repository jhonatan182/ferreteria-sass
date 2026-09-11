'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { customersApi, type Customer } from '@/lib/customers';
import { useHasPermission } from '@/lib/permissions';

import { Field } from '../../productos/ui';

/** Detalle y edición de un cliente (RF-090). El cliente general no se desactiva
 * ni recibe límite de crédito (RF-091/RF-092, docs/04 sección 48 D1). */
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canUpdate = useHasPermission('customers.update');
  const canDeactivate = useHasPermission('customers.deactivate');
  const canChangeCreditLimit = useHasPermission('credits.change_limit');

  const [data, setData] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [identification, setIdentification] = useState('');
  const [phone, setPhone] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

  const fill = useCallback((c: Customer) => {
    setData(c);
    setName(c.name);
    setIdentification(c.identification ?? '');
    setPhone(c.phone ?? '');
    setEmailValue(c.email ?? '');
    setAddress(c.address ?? '');
    setCreditLimit(c.creditLimit);
  }, []);

  const load = useCallback(async () => {
    try {
      fill(await customersApi.get(id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cargar el cliente.');
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
        await customersApi.update(id, {
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
      fill(await customersApi.setActive(id, !data.isActive));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveCreditLimit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      fill(await customersApi.changeCreditLimit(id, creditLimit.trim() || '0'));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo cambiar el límite de crédito.');
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
        <p className="text-sm text-destructive">{error ?? 'Cliente no encontrado.'}</p>
        <Link href="/app/clientes" className="text-sm underline">
          Volver a clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          {data.name}
          {data.isGeneralCustomer ? (
            <span className="ml-2 align-middle inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Cliente general
            </span>
          ) : null}
        </h1>
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
          {canDeactivate && !data.isGeneralCustomer ? (
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
            <Link href="/app/clientes">Volver</Link>
          </Button>
        </div>
      </form>

      {canChangeCreditLimit && !data.isGeneralCustomer ? (
        <form onSubmit={onSaveCreditLimit} className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Límite de crédito</h2>
          <p className="text-xs text-muted-foreground">
            Antes de completar una venta al crédito, el backend valida que
            saldo + total no exceda este límite (RF-112).
          </p>
          <Field label="Límite de crédito">
            <Input
              inputMode="decimal"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
          </Field>
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar límite'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
