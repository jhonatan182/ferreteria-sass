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
