# Ferretería SaaS

Plataforma **SaaS multi-tenant** para la gestión operativa y administrativa de
ferreterías. Consolida en un solo sistema el ciclo del negocio:

```text
Producto → Compra → Inventario → Venta → Pago / Crédito → Caja → Reportes
```

con aislamiento de datos por empresa (tenant), control de roles y permisos, y
planes/suscripciones SaaS. El objetivo es reemplazar controles dispersos en
papel, Excel o sistemas parciales, sin perder trazabilidad de quién hizo cada
operación y cómo afectó al negocio.

> **Regla base del proyecto:** el backend es la autoridad de negocio. Nunca se
> confía en `tenantId`, permisos, totales, precios, stock ni estados críticos
> enviados por el frontend.

---

## Estado actual

El desarrollo avanza por fases. Implementado hasta hoy:

| Fase | Alcance | Estado |
|------|---------|--------|
| 1 | Base técnica del monorepo (pnpm, Next.js, NestJS, Prisma, Docker) | ✅ |
| 2 | Fundación SaaS e identidad (User, Tenant, Membership, Roles, Permisos, Planes, Features, Límites, Suscripciones, auditoría de plataforma) | ✅ |
| 3 | Autenticación (sesión opaca en BD), contexto de tenant y autorización por permisos | ✅ |
| 4 | Catálogo comercial de productos (Product, Presentación, Categoría, Marca, Unidad) + `AuditLog` operativo | ✅ |
| 5+ | Inventario / kardex, compras, ventas, crédito, caja, reportes | ⏳ pendiente |

Todavía **no** existen existencias, movimientos de inventario, compras, ventas,
caja ni créditos.

---

## Stack

| Capa | Tecnología |
|------|------------|
| Monorepo | pnpm workspaces |
| Frontend (`apps/web`) | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui |
| Backend (`apps/api`) | NestJS 12 (ESM) · TypeScript · REST |
| ORM / DB | Prisma 7 · PostgreSQL 16 |
| Validación | Zod (`packages/validation`) |
| Tests | Vitest (unit + e2e contra BD real) |
| Lint | oxlint (`api`, `packages/*`) · eslint (`web`) |

Requisitos locales: **Node ≥ 22**, **pnpm 10** (via corepack) y **Docker** (para
PostgreSQL).

---

## Estructura del monorepo

```text
apps/
  web/    Next.js — login, selección de tenant, área protegida /app
  api/    NestJS + Prisma — API REST bajo el prefijo /api
    src/authz/     catálogo de permisos, plantillas de roles, códigos de features y límites
    src/auth/      sesión opaca en BD, bcrypt, 4 guards globales, decoradores
    src/common/    filtro global de errores + catálogo ERROR_CODES
    src/audit/     AuditLog operativo append-only (escribe dentro de la transacción)
    src/products/  catálogo comercial (Product, Presentation, Category, Brand, Unit)
    src/roles/     GET /api/roles (tenant-scoped)
packages/
  config/       tsconfig / prettier / oxlint compartidos
  types/        contratos de tipos (sin runtime)
  validation/   esquemas zod (uuid, dinero, cantidad, ...)
prisma/
  schema.prisma migraciones y modelo de dominio
  seed.ts       catálogo de plataforma (todo entorno) + datos demo (solo fuera de producción)
docker-compose.yml   PostgreSQL 16 para desarrollo (puerto host 5433)
.env.example         plantilla de variables de entorno
```

El cliente Prisma se genera en `apps/api/src/generated/prisma/` (ignorado por
git; se regenera con `pnpm db:generate`).

---

## Puesta en marcha

Desde la raíz del repositorio:

```bash
# 1. Dependencias de todo el workspace (dispara prisma generate)
pnpm install

# 2. Variables de entorno
cp .env.example .env
#    Editar .env: los valores por defecto sirven para desarrollo local.
#    AUTH_SECRET está reservado (la sesión actual no lo necesita), pero puedes
#    generarlo ya. En PowerShell:
#    [Convert]::ToBase64String((1..32 | % { Get-Random -Max 256 }))

# 3. Base de datos PostgreSQL (Docker) -> localhost:5433
pnpm db:up

# 4. Aplicar migraciones
pnpm db:migrate

# 5. Sembrar datos (idempotente): permisos, features, plan y tenant demo
pnpm db:seed

# 6. Arrancar backend + frontend + watchers de packages
pnpm dev
```

Servicios:

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000/api |
| Healthcheck | http://localhost:4000/api/health → `{ "status": "ok", "db": "up" }` |
| Prisma Studio | `pnpm db:studio` |

### Credenciales de desarrollo

El seed crea (solo cuando `NODE_ENV` ≠ `production` y el usuario aún no tiene
contraseña):

| Rol | Email | Contraseña por defecto |
|-----|-------|------------------------|
| Platform Admin | `admin@localhost` | `admin-dev-2026` |
| Owner del tenant demo | `owner@localhost` | `owner-dev-2026` |

Los emails y contraseñas se configuran en `.env` (`PLATFORM_ADMIN_*`,
`DEV_TENANT_OWNER_*`). El Platform Admin no tiene membresía de tenant: los
endpoints tenant-scoped le responden `NO_TENANT_ACCESS` por diseño.

---

## Cómo funciona

### Autenticación y sesión

- Sesión **opaca con estado en BD** (modelo `Session`): no hay JWT. Se guarda el
  hash SHA-256 del token, el `activeTenantId`, un `expiresAt` deslizante y
  `revokedAt`.
- Cookie `httpOnly` `ferreteria_session`. El frontend hace `fetch` con
  `credentials: 'include'`.
- Contraseñas con **bcrypt** (coste 12), con `compare` dummy anti-timing.
- Rate limit solo en `POST /auth/login` (por IP).

### Tenant activo

El tenant activo vive **solo en el servidor** (`Session.activeTenantId`). El body
de `select-tenant` es una propuesta que se revalida contra `TenantMembership`.
Si el usuario tiene una sola membresía activa, se auto-selecciona; si tiene
varias, la API responde `TENANT_SELECTION_REQUIRED` (409).

### Cadena de autorización

Cuatro guards globales de NestJS se ejecutan en orden en cada request:

```text
AuthenticationGuard → PlatformAdminGuard → TenantContextGuard → PermissionsGuard
```

que materializan la política del proyecto:

```text
Authentication → Membership → Tenant → Subscription → Feature → Limit
→ Permission → Resource ownership → Business rules
```

Decoradores disponibles: `@Public`, `@PlatformAdminOnly`, `@TenantOptional`,
`@RequirePermissions(...codes)`, y params `@CurrentUser` / `@CurrentContext` /
`@CurrentTenant`.

### Multi-tenancy en queries

Ninguna query sobre una entidad tenant-owned se hace solo por `id`: siempre
incorpora o verifica `tenantId`. Un recurso de otro tenant devuelve **404**.

### Planes, features y límites

El comportamiento nunca se decide por el nombre del plan. Se usan **features**
(capacidades on/off) y **límites** (cuotas numéricas, p. ej. `MAX_PRODUCTS`
cuenta productos activos). El `TenantContextGuard` ya carga features y límites
del plan en el contexto del request; los módulos de dominio los aplican.

### Errores

Todo error se normaliza a `{ code, message, details? }` con códigos funcionales
estables del catálogo `ERROR_CODES` (`INSUFFICIENT_STOCK`, `PRODUCT_CODE_TAKEN`,
`BUSINESS_RULE_VIOLATION`, ...).

### Auditoría

`AuditService.record(tx, ctx, entry)` escribe en `AuditLog` **dentro de la misma
transacción** de la operación auditada. El historial crítico es append-only:
nunca se borra físicamente.

### Endpoints actuales

| Método | Ruta | Notas |
|--------|------|-------|
| `GET` | `/api/health` | público |
| `POST` | `/api/auth/login` | público + rate limit |
| `POST` | `/api/auth/logout` | |
| `GET` | `/api/auth/me` | tenant opcional; devuelve selector de tenant |
| `POST` | `/api/auth/select-tenant` | |
| `GET` | `/api/auth/context` | |
| `GET` | `/api/roles` | permiso `roles.read`, tenant-scoped |
| `GET/POST/PATCH` | `/api/products`, `/api/products/:id/presentations`, `/api/categories`, `/api/brands`, `/api/units` | permisos `products.*` |

---

## Comandos

```bash
pnpm install          # instala el workspace (+ prisma generate)

pnpm db:up            # PostgreSQL (Docker) -> localhost:5433
pnpm db:down          # apaga PostgreSQL
pnpm db:generate      # regenera el cliente Prisma
pnpm db:migrate       # crea/aplica migración (prisma migrate dev)
pnpm db:seed          # siembra plataforma + datos demo (idempotente)
pnpm db:studio        # Prisma Studio

pnpm dev              # web + api + watchers de packages en paralelo
pnpm dev:api          # solo backend  -> http://localhost:4000/api
pnpm dev:web          # solo frontend -> http://localhost:3000

pnpm build            # db:generate + build de packages y apps
pnpm lint             # oxlint (api, packages) + eslint (web)
pnpm typecheck        # tsc --noEmit en todo el workspace
pnpm test             # tests unitarios (vitest)
pnpm test:e2e         # tests e2e (requieren la BD levantada)
pnpm format           # prettier --write .
```

---

## Notas del entorno de desarrollo

- **PostgreSQL usa el puerto host `5433`** (no 5432) para no chocar con
  instalaciones nativas o con otros contenedores.
- **Prisma 7**: la URL de conexión ya no vive en `schema.prisma`. El CLI la lee
  de `prisma.config.ts` (raíz); `PrismaClient` usa el driver adapter
  `@prisma/adapter-pg` en `apps/api/src/prisma/prisma.service.ts`.
- Si en tu máquina conviven pnpm 9 y pnpm 10, el `.npmrc` tiene
  `package-manager-strict=false`; los WARN de versión son inofensivos.
- Algunos peer-dependency warnings (`@nestjs/throttler` pide Nest ^11 y corre en
  12; `vite-tsconfig-paths` pide TS ^5) son conocidos e ignorables.

---

## Antes de contribuir

Lectura obligatoria para cualquier persona (o agente) que implemente
funcionalidad:

1. `AGENTS.md` — reglas obligatorias del proyecto.
2. `CLAUDE.md` — estructura y comandos.
3. `docs/00-DISEÑO-SAAS.md` … `docs/07-ARQUITECTURA-TECNICA.md` — diseño,
   visión, reglas de negocio, roles y permisos, modelo de dominio, flujos,
   requerimientos funcionales y arquitectura técnica.

No inventes reglas de negocio si ya están definidas en esos documentos. Si el
código existente entra en conflicto con la documentación, indícalo antes de
perpetuar el conflicto.

**Definition of Done** (según corresponda a la tarea): compila · lint pasa ·
tests pasan · respeta tenant · respeta permisos · respeta plan · maneja errores ·
usa transacción · audita · tiene migración · documentación actualizada.
