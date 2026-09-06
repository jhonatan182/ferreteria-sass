# 00 — Diseño SaaS

**Proyecto:** Sistema SaaS de Gestión para Ferreterías  
**Versión:** 1.0  
**Estado:** Base aprobada para implementación  
**Fecha:** 2026-09-05

---

## 1. Propósito

El sistema se desarrollará como un **producto SaaS multi-tenant desde la primera versión**.

Aunque el primer cliente sea una sola ferretería, ninguna decisión técnica o funcional debe asumir que solamente existirá una empresa.

El objetivo es construir una plataforma reutilizable para múltiples ferreterías, manteniendo:

- aislamiento estricto de datos;
- roles y permisos por tenant;
- planes y límites comerciales;
- suscripciones;
- auditoría;
- módulos operativos independientes;
- evolución futura sin rehacer la arquitectura base.

---

## 2. Principios fundamentales

### 2.1 Multi-tenant desde V1

La aplicación utilizará:

- una base de datos PostgreSQL;
- tablas compartidas;
- aislamiento lógico por `tenantId`.

No se crearán bases de datos independientes por tenant en V1.

### 2.2 Backend como autoridad

El frontend nunca será una frontera de seguridad.

El backend será responsable de:

- identificar al usuario;
- resolver el tenant activo;
- validar membresía;
- validar estado del tenant;
- validar suscripción;
- validar features;
- validar límites;
- validar permisos;
- validar pertenencia del recurso;
- validar reglas de negocio;
- calcular importes;
- ejecutar transacciones;
- registrar auditoría.

### 2.3 Denegación por defecto

Si una acción no está explícitamente permitida, debe rechazarse.

### 2.4 Historial antes que mutación destructiva

Las operaciones importantes no se corrigen borrando datos históricos.

Se utilizarán:

- cancelaciones;
- devoluciones;
- ajustes;
- movimientos compensatorios.

### 2.5 Simplicidad técnica

Se utilizará un monolito modular.

No se introducirán microservicios, Kubernetes, Kafka, CQRS completo ni event sourcing en V1.

---

## 3. Actores principales

### 3.1 Platform Admin

Es el administrador del producto SaaS.

Puede administrar:

- tenants;
- planes;
- features;
- límites;
- suscripciones;
- pagos SaaS;
- suspensión/reactivación;
- auditoría de plataforma.

No debe operar automáticamente dentro de la información comercial de los tenants.

### 3.2 Tenant Owner

Es el propietario o administrador principal de una ferretería.

Puede administrar ampliamente:

- usuarios;
- roles;
- productos;
- inventario;
- compras;
- ventas;
- caja;
- créditos;
- reportes;
- configuración del tenant.

No administra la plataforma SaaS.

### 3.3 Usuarios operativos

Roles iniciales:

- `OWNER`
- `MANAGER`
- `CASHIER`
- `INVENTORY_MANAGER`
- `PURCHASES_MANAGER`

Posteriormente podrán existir roles personalizados.

---

## 4. Arquitectura general

```text
Usuario
  |
  v
Next.js Web
  |
  | HTTPS / REST
  v
NestJS API
  |
  v
PostgreSQL
```

### Componentes

- **Frontend:** Next.js + TypeScript.
- **Backend:** NestJS + TypeScript.
- **Base de datos:** PostgreSQL.
- **ORM:** Prisma.
- **API:** REST.
- **Repositorio:** monorepo.

---

## 5. Estructura multi-tenant

Entidades base:

```text
Tenant
  |
  +-- TenantMembership -- User
  |        |
  |        +-- Role -- RolePermission -- Permission
  |
  +-- Products
  +-- Inventory
  +-- Purchases
  +-- Sales
  +-- Customers
  +-- Suppliers
  +-- Cash
  +-- Credits
  +-- Reports
  +-- AuditLog
```

Una persona puede pertenecer a varios tenants en el futuro.

El acceso siempre se produce mediante una `TenantMembership`.

---

## 6. Resolución del tenant activo

El frontend podrá indicar qué tenant desea utilizar cuando un usuario tenga varias membresías, pero **no podrá imponer un tenant arbitrario**.

El backend debe comprobar:

1. usuario autenticado;
2. membresía activa al tenant solicitado;
3. tenant activo;
4. suscripción utilizable;
5. autorización de la acción.

Nunca debe aceptarse un `tenantId` de una petición como prueba suficiente de pertenencia.

---

## 7. SaaS comercial

### 7.1 Planes

Los planes serán configurables.

Ejemplo conceptual:

```text
BASIC
PROFESSIONAL
PREMIUM
```

Los nombres no deben gobernar el código.

Incorrecto:

```ts
if (plan === "PREMIUM") {
  // ...
}
```

Correcto:

```text
Plan
  +-- Features
  +-- Limits
```

### 7.2 Features

Ejemplos:

- `CREDITS`
- `CASH`
- `ADVANCED_REPORTS`
- `PAYROLL`

### 7.3 Límites

Ejemplos:

- `MAX_USERS`
- `MAX_PRODUCTS`

Un valor nulo podrá representar ausencia de límite comercial artificial.

---

## 8. Suscripciones

Estados:

- `ACTIVE`
- `PAST_DUE`
- `SUSPENDED`
- `CANCELLED`

### Flujo

```text
ACTIVE
  |
  | termina período
  v
PAST_DUE
  |
  | termina grace period
  v
SUSPENDED
```

Un pago o intervención administrativa válida podrá reactivar la suscripción.

### Grace period

V1 utilizará **7 días por defecto**.

Debe ser configurable a nivel de plataforma.

---

## 9. Suspensión

La suspensión:

- no elimina datos;
- no elimina usuarios;
- no elimina historial;
- bloquea las operaciones normales;
- conserva acceso mínimo necesario para mostrar el estado de cuenta/suscripción cuando corresponda.

Platform Admin mantiene acceso administrativo de plataforma.

---

## 10. Pagos SaaS V1

Los pagos de suscripción serán manuales.

Platform Admin podrá:

- registrar pago;
- definir referencia;
- definir monto;
- asociar período;
- extender vigencia;
- reactivar suscripción.

No se implementará todavía:

- Stripe;
- PayPal;
- PixelPay;
- webhooks;
- cobros automáticos.

El modelo quedará preparado para integrar proveedores posteriormente.

---

## 11. Módulos funcionales

Orden lógico:

1. SaaS base.
2. Autenticación.
3. Tenants.
4. Usuarios, roles y permisos.
5. Productos.
6. Inventario.
7. Proveedores.
8. Compras.
9. Clientes.
10. Ventas.
11. Caja.
12. Créditos.
13. Reportes.
14. Auditoría.
15. Administración comercial SaaS.

---

## 12. Regla de operaciones de dominio

Las operaciones críticas deben expresarse como acciones explícitas.

Ejemplos:

```text
completePurchase
cancelPurchase
completeSale
cancelSale
createRefund
registerCreditPayment
openCashSession
closeCashSession
adjustInventory
```

No deben resolverse mediante edición libre de campos internos.

---

## 13. Integridad

Las siguientes operaciones deben ejecutarse atómicamente:

- completar compra;
- cancelar compra;
- completar venta;
- cancelar venta;
- devolución;
- abono de crédito;
- cierre de caja cuando genere movimientos;
- ajustes relevantes;
- renovación de suscripción cuando implique múltiples registros.

Si falla una parte, se revierte toda la operación.

---

## 14. Identificadores

IDs internos:

- UUID.

Códigos visibles del negocio pueden ser secuenciales por tenant.

Ejemplo:

```text
FER-000001
```

El código visible nunca reemplaza el UUID interno.

---

## 15. Decisiones cerradas

Para evitar ambigüedad durante implementación:

1. El sistema es multi-tenant desde V1.
2. El backend determina la seguridad.
3. No hay stock negativo por defecto.
4. El inventario se almacena en unidad base.
5. El costo inicial es promedio ponderado.
6. Ventas/compras completadas no se eliminan.
7. Créditos se modelan mediante movimientos.
8. Caja se modela mediante sesiones y movimientos.
9. Planes son data-driven.
10. Pagos SaaS son manuales en V1.
11. Grace period inicial: 7 días.
12. Monolito modular.
13. PostgreSQL como fuente de verdad.
14. Prisma como ORM.
15. REST como interfaz principal.
