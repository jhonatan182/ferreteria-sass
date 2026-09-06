# 07 — Arquitectura Técnica

**Versión:** 1.0  
**Estado:** Base aprobada para implementación  
**Fecha:** 2026-09-05

---

## 1. Stack definitivo

### Frontend

- Next.js.
- React.
- TypeScript.
- App Router.

### Backend

- NestJS.
- TypeScript.
- REST.

### Persistencia

- PostgreSQL.
- Prisma ORM.

### Repositorio

Monorepo.

---

## 2. Estructura propuesta

```text
ferreteria-saas/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── types/
│   ├── validation/
│   └── config/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docs/
│   ├── 00-DISEÑO-SAAS.md
│   ├── 01-VISION-Y-ALCANCE.md
│   ├── 02-REGLAS-DEL-NEGOCIO.md
│   ├── 03-ROLES-Y-PERMISOS.md
│   ├── 04-MODELO-DE-DOMINIO.md
│   ├── 05-FLUJOS-OPERATIVOS.md
│   ├── 06-REQUERIMIENTOS-FUNCIONALES.md
│   └── 07-ARQUITECTURA-TECNICA.md
│
├── AGENTS.md
└── package.json
```

---

## 3. Backend modular

```text
apps/api/src/
├── auth/
├── tenants/
├── users/
├── roles/
├── permissions/
├── plans/
├── subscriptions/
├── products/
├── inventory/
├── suppliers/
├── purchases/
├── customers/
├── sales/
├── credits/
├── cash/
├── reports/
└── audit/
```

---

## 4. Capas prácticas

No se exige una arquitectura académica excesiva.

Flujo recomendado:

```text
Controller
  ->
Application / Use Case
  ->
Domain services / Rules
  ->
Prisma Repository / DB
```

Los controllers no deben implementar reglas comerciales complejas.

---

## 5. Contexto autenticado

El backend debe construir un contexto equivalente a:

```ts
type RequestContext = {
  userId: string;
  tenantId: string;
  membershipId: string;
  roleId: string;
  permissions: string[];
};
```

La implementación exacta puede variar.

---

## 6. Seguridad por tenant

Toda query tenant-owned debe incorporar el tenant.

Ejemplo conceptual:

```ts
where: {
  id,
  tenantId: context.tenantId
}
```

Nunca:

```ts
where: { id }
```

si el recurso pertenece a un tenant.

---

## 7. Autenticación

La implementación deberá usar una solución madura compatible con Next.js y NestJS.

Requisitos:

- hash seguro de contraseña;
- sesiones/tokens seguros;
- expiración;
- logout;
- usuario activo;
- protección CSRF cuando el mecanismo elegido lo requiera;
- cookies `httpOnly`, `secure` en producción si se usan cookies;
- no almacenar secretos en frontend.

La selección final de librería puede hacerse durante bootstrap técnico.

---

## 8. Autorización

Orden:

```text
Authentication
  ->
Membership
  ->
Tenant Status
  ->
Subscription
  ->
Feature
  ->
Limit
  ->
Permission
  ->
Resource ownership
  ->
Business rules
```

### Responsabilidades

Guards:

- autenticación;
- contexto;
- permiso;
- acceso general.

Use cases:

- reglas comerciales;
- estado;
- stock;
- crédito;
- caja;
- límites específicos;
- consistencia.

---

## 9. Features y límites

Debe existir un servicio centralizado.

Ejemplo:

```ts
featureService.has("CREDITS")
limitService.assertAvailable("MAX_USERS")
```

No dispersar decisiones de plan dentro de todos los módulos.

---

## 10. Prisma

Reglas:

- UUID en IDs.
- `Decimal`/`numeric` para dinero.
- relaciones explícitas.
- índices tenant-aware.
- migraciones obligatorias.
- transacciones en operaciones críticas.

---

## 11. Constraints de base de datos

Agregar unicidad compuesta cuando corresponda.

Ejemplos:

```text
@@unique([tenantId, internalCode])
@@unique([tenantId, barcode])
```

Cuando `barcode` pueda ser nulo, validar además el comportamiento real de PostgreSQL/Prisma para múltiples nulos.

---

## 12. Dinero y precisión

Nunca usar `float` para:

- precios;
- costos;
- saldos;
- pagos;
- totales.

Usar decimal.

Los totales definitivos se calculan en backend.

---

## 13. Unidades y cantidades

Las cantidades que puedan incluir fracciones deberán usar precisión decimal.

Ejemplo:

```text
1.5 metros
0.25 galones
```

No asumir enteros.

---

## 14. Inventario

### Fuente histórica

`InventoryMovement`.

### Estado actual

`InventoryBalance`.

`InventoryBalance` es una proyección/materialización del estado actual.

Toda actualización debe realizarse de forma consistente con el movimiento asociado.

---

## 15. Compra completa

```text
CompletePurchaseUseCase
  |
  +-- validate state
  +-- calculate totals
  +-- create/lock required inventory balances
  +-- create inventory movements
  +-- update weighted average cost
  +-- mark purchase COMPLETED
  +-- audit
```

Todo dentro de transacción.

---

## 16. Venta completa

```text
CompleteSaleUseCase
  |
  +-- validate state
  +-- validate items
  +-- convert quantities
  +-- validate stock
  +-- calculate totals
  +-- create inventory movements
  +-- create payments
  +-- create credit movement if needed
  +-- create cash movement if needed
  +-- mark sale COMPLETED
  +-- audit
```

Todo dentro de transacción.

---

## 17. Concurrencia de inventario

La validación de stock realizada antes de la transacción sirve únicamente como UX.

La verificación definitiva debe ocurrir dentro de la transacción.

Opciones válidas:

- bloqueo de filas;
- actualización condicional;
- aislamiento transaccional apropiado.

Recomendación inicial:

1. obtener/crear `InventoryBalance`;
2. bloquear o actualizar condicionalmente;
3. comprobar saldo;
4. disminuir;
5. crear movimiento;
6. completar transacción.

---

## 18. Idempotencia funcional

Una entidad `COMPLETED` no puede completarse de nuevo.

Una entidad `CANCELLED` no puede cancelarse de nuevo.

Los use cases deben validar estado antes de aplicar efectos.

Esto previene doble clic, retry del navegador o petición duplicada.

---

## 19. Costo promedio ponderado

Conceptualmente:

```text
nuevoCosto =
  (
    stockAnterior * costoAnterior
    +
    cantidadEntrada * costoEntrada
  )
  /
  (stockAnterior + cantidadEntrada)
```

Si el stock anterior es cero:

```text
nuevoCosto = costoEntrada
```

El cálculo se realiza dentro de la misma transacción.

---

## 20. Caja

Modelo:

```text
CashRegister
  |
  +-- CashSession
        |
        +-- CashMovement
```

No utilizar un simple campo `cashBalance` como única fuente.

---

## 21. Créditos

Modelo:

```text
CreditAccount
  |
  +-- CreditMovement
```

Tipos:

```text
SALE
PAYMENT
ADJUSTMENT
```

El saldo puede materializarse para rendimiento, pero los movimientos son la trazabilidad principal.

---

## 22. API REST

CRUD cuando corresponda:

```text
GET    /products
POST   /products
GET    /products/:id
PATCH  /products/:id
```

Acciones de dominio:

```text
POST /purchases/:id/complete
POST /purchases/:id/cancel

POST /sales/:id/complete
POST /sales/:id/cancel
POST /sales/:id/refunds

POST /cash/sessions/open
POST /cash/sessions/:id/close

POST /credits/:id/payments
```

---

## 23. DTOs

Validar runtime:

- UUID;
- strings;
- enums;
- dinero;
- cantidad;
- rango;
- requeridos;
- arrays;
- relaciones.

TypeScript no reemplaza validación de entrada.

---

## 24. Errores HTTP

Convención sugerida:

- `400`: solicitud inválida.
- `401`: no autenticado.
- `403`: no autorizado.
- `404`: recurso inexistente.
- `409`: conflicto de estado/concurrencia.
- `422`: regla de negocio no satisfecha, si se decide utilizarla.
- `500`: error inesperado.

La API debe devolver un código funcional estable además del mensaje.

Ejemplo:

```json
{
  "code": "INSUFFICIENT_STOCK",
  "message": "No hay existencia suficiente para completar la venta."
}
```

---

## 25. Auditoría

`AuditLog` conceptual:

```text
id
tenantId
userId
action
entityType
entityId
metadata
createdAt
```

Auditoría de plataforma podrá utilizar una entidad separada.

---

## 26. Logs técnicos

Los logs deben incluir contexto suficiente:

- request id;
- user id cuando exista;
- tenant id cuando exista;
- endpoint;
- error.

Nunca registrar:

- contraseñas;
- tokens;
- secretos;
- datos sensibles innecesarios.

---

## 27. Frontend

Responsabilidades:

- navegación;
- formularios;
- UX;
- tablas;
- filtros;
- feedback;
- ocultamiento visual por permisos;
- consumo de API.

No es responsable de la seguridad definitiva.

---

## 28. Estado del servidor

Evitar duplicar innecesariamente en frontend información que ya es autoridad del backend.

Para datos remotos utilizar una estrategia consistente de server-state/cache.

No introducir Redux por defecto si no existe necesidad demostrada.

---

## 29. Paginación

Listados potencialmente grandes deben utilizar paginación en backend.

Ejemplos:

- productos;
- ventas;
- compras;
- kardex;
- clientes;
- auditoría.

---

## 30. Búsqueda

Debe favorecer:

- código;
- código de barras;
- nombre;
- identificación cuando aplique.

Crear índices según patrones reales de búsqueda.

---

## 31. Testing

### Unitarias

Prioridad:

- conversiones;
- costo ponderado;
- crédito;
- límites;
- caja;
- cálculo de totales.

### Integración

Prioridad:

- aislamiento tenant;
- completar compra;
- completar venta;
- venta al crédito;
- abono;
- cierre de caja;
- cancelaciones;
- concurrencia.

### E2E

Flujo mínimo:

```text
login
-> producto
-> proveedor
-> compra
-> inventario
-> apertura caja
-> cliente
-> venta
-> crédito
-> abono
-> cierre caja
-> reportes
```

---

## 32. Variables de entorno

Nunca versionar secretos.

Mantener `.env.example`.

Variables esperadas conceptualmente:

```text
DATABASE_URL
AUTH_SECRET
APP_URL
API_URL
```

---

## 33. Migraciones

Prisma Migrate será el mecanismo estándar.

Proceso:

```text
schema change
-> migration
-> test
-> deploy
```

No editar producción manualmente como flujo normal.

---

## 34. Backups

Producción debe tener:

- backups automáticos;
- retención;
- restauración documentada;
- prueba periódica de restore.

---

## 35. Deployment

Priorizar servicios administrados y sencillos.

Requisitos:

- HTTPS;
- PostgreSQL administrado preferiblemente;
- deploy reproducible;
- backups;
- logs;
- variables seguras.

No usar Kubernetes en V1.

---

## 36. Redis

No es obligatorio.

Solo introducirlo si existe una necesidad real:

- cache;
- rate-limit distribuido;
- colas;
- locks distribuidos.

No agregarlo preventivamente.

---

## 37. Jobs programados

La transición:

```text
ACTIVE -> PAST_DUE -> SUSPENDED
```

requiere ejecución programada.

Puede implementarse inicialmente mediante:

- cron del backend;
- scheduler de plataforma;
- job administrado.

Debe ser idempotente.

---

## 38. Zona horaria

Persistir timestamps de forma consistente en UTC.

Mostrar fechas usando la zona configurada del tenant.

No guardar fechas locales ambiguas como estrategia principal.

---

## 39. Moneda

El tenant deberá tener una moneda base configurable.

Para el primer cliente se podrá configurar HNL.

No hardcodear HNL en reglas de dominio.

---

## 40. Impuestos

No hardcodear un porcentaje tributario dentro del núcleo.

El sistema debe permitir configurar impuestos cuando el módulo correspondiente se implemente.

---

## 41. Seguridad mínima de producción

- HTTPS;
- cookies/tokens seguros;
- rate limiting en autenticación;
- validación runtime;
- tenant isolation;
- permisos backend;
- secretos protegidos;
- SQL mediante Prisma;
- no exponer stack traces;
- auditoría crítica.

---

## 42. Definition of Done técnica

Una tarea no está terminada únicamente porque la pantalla funcione.

Debe cumplir, según corresponda:

- UI;
- API;
- validación;
- autorización;
- tenant isolation;
- reglas;
- transacción;
- auditoría;
- tests;
- migración;
- manejo de errores;
- documentación actualizada.

---

## 43. Decisiones de implementación — Autenticación (Fase 3)

La sección 7 delega el mecanismo concreto al "bootstrap técnico". Estas son las
decisiones tomadas al implementar la fase de autenticación, contexto de tenant y
autorización base (AGENTS.md §28-29: se documentan aquí).

### 43.1 Sesión

**Sesión opaca con estado en base de datos** (modelo `Session`), no JWT.

- El navegador solo recibe un token aleatorio de 32 bytes en la cookie
  `ferreteria_session` (`httpOnly`, `sameSite=lax` configurable, `secure` en
  producción, `path=/`). En la tabla `sessions` se guarda únicamente su
  **SHA-256**; el token en claro nunca se persiste ni se registra.
- Expiración **absoluta y deslizante**: `expires_at` se renueva en cada uso
  (como mucho una escritura por minuto) hasta `SESSION_TTL_HOURS` (default 168 h
  = 7 días).
- **RF-004** se cumple de verdad: `logout` marca `revoked_at`; el guard rechaza
  la sesión de inmediato. Al desactivar un usuario se revocan **todas** sus
  sesiones.
- `Session.active_tenant_id` es la **única** fuente del tenant activo. El
  `tenantId` del cliente (body de `select-tenant`) es solo una propuesta que se
  valida contra `TenantMembership` antes de persistirse (docs/00 §6, RN-003).

### 43.2 Contraseñas

**bcrypt** (`bcryptjs`, JS puro — sin binarios nativos, compatible con el build
ESM), coste `BCRYPT_COST` (default 12). Verificación en tiempo constante: si el
usuario no existe o no tiene `password_hash`, se ejecuta igualmente un `compare`
contra un hash ficticio (anti *timing oracle*).

El seed asigna contraseñas de desarrollo (`PLATFORM_ADMIN_PASSWORD` /
`DEV_TENANT_OWNER_PASSWORD`, defaults `admin-dev-2026` / `owner-dev-2026`) solo
fuera de producción y solo si el usuario aún no tiene credencial.

### 43.3 Rate limiting

`@nestjs/throttler` aplicado exclusivamente a `POST /auth/login`
(`AUTH_LOGIN_RATE_LIMIT` / `AUTH_LOGIN_RATE_TTL_SECONDS`, default 5 / 60 s por
IP). Cumple el requisito de la sección 41.

### 43.4 Cadena de guards

Cuatro guards globales, en el orden de AGENTS.md §6:

1. `AuthenticationGuard` — cookie → sesión → usuario `ACTIVE` (revalidado en
   cada request). Se salta con `@Public()`.
2. `PlatformAdminGuard` — solo rutas `@PlatformAdminOnly()`; exige
   `isPlatformAdmin` y **no** resuelve contexto de tenant (RP-008).
3. `TenantContextGuard` — Membership → Tenant status → Subscription. Construye el
   `RequestContext`. Se salta con `@Public()` / `@PlatformAdminOnly()`; con
   `@TenantOptional()` no falla si el contexto no resuelve (lo usa `/auth/me`).
4. `PermissionsGuard` — `@RequirePermissions(...)`; exige **todos**. Sin permiso
   explícito → denegado (RF-012 / RP-033).

**Feature y límite** (pasos 5-6) tienen servicios centralizados
(`FeatureService`, `LimitService`) listos, pero todavía no se aplican como guard:
los invocarán los módulos de dominio cuando existan.

### 43.5 Resolución del tenant activo

- 0 membresías activas → `NO_TENANT_ACCESS` (403). En **login** también se
  deniega (coincide con el diagrama de docs/05 §4), salvo Platform Admin.
- 1 membresía activa → auto-selección, persistida en la sesión.
- >1 y ninguna elegida → `TENANT_SELECTION_REQUIRED` (409) en endpoints
  tenant-scoped; `/auth/me` devuelve la lista para que el frontend muestre el
  selector.

### 43.6 Suscripción "utilizable"

`ACTIVE` o `PAST_DUE` permiten operar (docs/05 §50, índice parcial
`subscription_one_active_per_tenant`). `SUSPENDED` / `CANCELLED` / inexistente →
`SUBSCRIPTION_UNUSABLE`. Tenant `SUSPENDED` → `TENANT_SUSPENDED`. La política
"acceso mínimo durante suspensión" (docs/05 1686) se implementará con un
decorador `@AllowSuspended` sobre endpoints concretos (estado de cuenta,
reactivación) cuando esos endpoints existan; por ahora se bloquea todo lo
tenant-scoped.

### 43.7 Catálogo de códigos de error (RF-180)

Forma estable de todo error: `{ code, message, details? }` (`@ferreteria/types`
`ApiError`), vía un filtro global.

| HTTP | `code` | Categoría RF-180 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | validación |
| 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS` | autenticación |
| 403 | `ACCOUNT_INACTIVE`, `NO_TENANT_ACCESS`, `TENANT_ACCESS_DENIED`, `MEMBERSHIP_INACTIVE`, `TENANT_SUSPENDED`, `SUBSCRIPTION_UNUSABLE`, `PERMISSION_DENIED`, `PLATFORM_ADMIN_REQUIRED` | autorización |
| 403 | `FEATURE_NOT_AVAILABLE` | feature no disponible |
| 404 | `NOT_FOUND` | recurso inexistente |
| 409 | `TENANT_SELECTION_REQUIRED` | conflicto |
| 409 | `PLAN_LIMIT_REACHED` | límite del plan |
| 422 | *(reservado)* | regla de negocio |
| 429 | `RATE_LIMITED` | — |
| 500 | `INTERNAL_ERROR` | — (sin stack trace al cliente) |

### 43.8 Endpoints

| Método | Ruta | Protección |
|---|---|---|
| POST | `/api/auth/login` | pública + rate limit |
| POST | `/api/auth/logout` | autenticado |
| GET | `/api/auth/me` | autenticado (tenant opcional) |
| POST | `/api/auth/select-tenant` | autenticado (tenant opcional) |
| GET | `/api/auth/context` | autenticado + tenant + suscripción |
| GET | `/api/roles` | + permiso `roles.read` |

### 43.9 `RequestContext`

Se mantiene el contrato de la sección 5 sin cambios
(`{ userId, tenantId, membershipId, roleId, permissions }`). Los datos extra
para features/límites (`tenant`, `subscription` con su set de features y mapa de
límites) viajan aparte en `request.tenantContext`, no en el contrato público.
