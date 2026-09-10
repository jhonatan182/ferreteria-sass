# Claude Code Instructions

Este repositorio contiene un SaaS multi-tenant para gestión de ferreterías.

## Antes de implementar

Lee `AGENTS.md`.

La documentación funcional y técnica está en `/docs`.

Orden de referencia:

1. docs/00-DISEÑO-SAAS.md
2. docs/01-VISION-Y-ALCANCE.md
3. docs/02-REGLAS-DEL-NEGOCIO.md
4. docs/03-ROLES-Y-PERMISOS.md
5. docs/04-MODELO-DE-DOMINIO.md
6. docs/05-FLUJOS-OPERATIVOS.md
7. docs/06-REQUERIMIENTOS-FUNCIONALES.md
8. docs/07-ARQUITECTURA-TECNICA.md

No inventes reglas de negocio si ya están definidas en estos documentos.

Antes de implementar una funcionalidad:

- identifica qué documentos la gobiernan;
- inspecciona el código existente;
- verifica el impacto en multi-tenancy;
- verifica permisos;
- verifica features y límites;
- determina si necesita transacción;
- determina si necesita auditoría;
- implementa tests relevantes.

El backend es la autoridad de negocio.

Nunca confíes en tenantId, permisos, totales, precios finales,
stock o estados críticos enviados por el frontend.

Si el código existente entra en conflicto con la documentación,
indícalo antes de perpetuar el conflicto.

## Estructura del monorepo

Gestor: **pnpm workspaces** (`pnpm-workspace.yaml`).

```text
apps/
  web/    Next.js (App Router) + TypeScript + Tailwind + shadcn/ui   -> @ferreteria/web
          login / select-tenant / pantalla protegida `/app`, AuthProvider,
          `src/lib/api.ts` (fetch con cookie), `src/proxy.ts` (redirección UX)
  api/    NestJS + TypeScript (ESM) + Prisma                         -> @ferreteria/api
  api/src/authz/  catálogo de permisos, plantillas de roles de sistema,
                  códigos de features y claves de límites (consumido por
                  el seed, los guards y el provisioning de tenants)
  api/src/auth/   fase 3: sesión opaca en BD, PasswordService (bcrypt),
                  TenantContextService, Feature/Limit services, 4 guards
                  globales (auth → platform-admin → tenant-context → permisos),
                  decoradores (@Public, @PlatformAdminOnly, @TenantOptional,
                  @RequirePermissions, @CurrentUser/@CurrentContext).
                  Decisiones: docs/07 §43
  api/src/common/ filtro global de errores + catálogo `ERROR_CODES` +
                  `prisma-error.ts` (detección estructural de P2002, no `instanceof`)
  api/src/roles/  `GET /api/roles` (permiso `roles.read`), tenant-scoped
  api/src/catalog/ `unit-catalog.ts`: unidades por defecto de un tenant nuevo
  api/src/audit/  fase 4: `AuditLog` operativo append-only. `AuditService.record`
                  escribe DENTRO de la transacción de la operación auditada.
                  `AuditModule` es `@Global`
  api/src/products/ fase 4: catálogo comercial. Product, ProductPresentation,
                  Category, Brand, Unit (tenant-owned). Sin existencias ni costo.
                  `ProductCodeService` genera `internalCode` con contador por
                  tenant + `UPDATE ... RETURNING` (concurrencia-seguro).
                  Decisiones: docs/04 §45
  api/src/inventory/ fase 5: inventario. InventoryBalance (estado materializado),
                  InventoryMovement (historial append-only), InventoryAdjustment.
                  `inventory.core.ts`: reglas puras reutilizables
                  (`recordMovementWithinTx` con `SELECT ... FOR UPDATE`,
                  `computeWeightedAverage`, `toBaseQuantity`). `InventoryService`
                  expone `increase/decrease/adjustWithinTx` para que Compras y
                  Ventas los consuman. `averageCost` = fuente de verdad del costo.
                  Consulta de existencia, kardex, ajustes manuales, cambio manual
                  de costo (`products.change_cost`). Decisiones: docs/04 §46
  api/src/suppliers/ fase 6: proveedores. Supplier (tenant-owned, `isActive`,
                  sin borrado fisico). CRUD + activate/deactivate.
  api/src/purchases/ fase 6: compras. Supplier/Purchase/PurchaseItem. Compra en
                  DRAFT (no toca inventario) -> `complete` (transaccional:
                  reutiliza `InventoryService.increaseWithinTx` = entrada +
                  promedio ponderado; recalcula totales en backend; `SELECT ...
                  FOR UPDATE` de la compra para idempotencia) -> `cancel`
                  (salida compensatoria `REVERSAL`; rechaza si dejaria stock
                  negativo; NO recalcula el promedio retroactivamente).
                  `purchases.core.ts`: reglas puras (`computeItemAmounts`,
                  `computePurchaseTotals`). Decisiones: docs/04 §47
packages/
  config/      tsconfig / prettier / oxlint compartidos             -> @ferreteria/config
  types/       contratos de tipos, sin runtime                      -> @ferreteria/types
  validation/  esquemas zod runtime (uuid, dinero, cantidad, ...)    -> @ferreteria/validation
prisma/
  schema.prisma   fundación SaaS e identidad (User, Tenant, TenantMembership,
                  Role, Permission, RolePermission, Plan, Feature, PlanFeature,
                  PlanLimit, Subscription, SubscriptionPeriod, SaaSPayment,
                  PlatformAuditLog) + Session (fase 3) +
                  fase 4: Unit, Category, Brand, Product, ProductPresentation,
                  TenantProductSequence, AuditLog (operativo). Enum CatalogStatus.
                  Índice único parcial `product_one_default_presentation`
                  (a mano en la migración)
                  fase 5: InventoryBalance (`@@unique([tenantId, productId])`),
                  InventoryMovement (append-only), InventoryAdjustment.
                  Enums InventoryMovementType, InventoryAdjustmentDirection
                  fase 6: Supplier (`@@unique([tenantId, name])`), Purchase
                  (`@@unique([tenantId, documentNumber])`), PurchaseItem.
                  Enum PurchaseStatus (DRAFT/COMPLETED/CANCELLED)
  seed.ts         catálogo de plataforma (todo entorno) + datos de desarrollo
                  (unidades por defecto, secuencia y productos demo del tenant;
                  contraseñas dev solo fuera de producción)
  migrations/     migraciones versionadas
prisma.config.ts  configuración del CLI de Prisma 7 (la conexión de PrismaClient
                  usa un driver adapter en apps/api/src/prisma/prisma.service.ts)
docker-compose.yml   PostgreSQL 16 para desarrollo
.env.example         plantilla de variables (copiar a .env)
```

El cliente Prisma se genera en `apps/api/src/generated/prisma/` (ignorado por git,
se regenera con `pnpm db:generate`).

Lint: `apps/api` y los `packages/*` usan **oxlint**; `apps/web` usa **eslint**
(`eslint-config-next`). `pnpm lint` ejecuta el linter propio de cada paquete.

## Comandos

Desde la raíz:

```bash
pnpm install          # instala todo el workspace (+ prisma generate)
cp .env.example .env   # completar AUTH_SECRET y las variables de seed (PLATFORM_ADMIN_*, DEV_TENANT_*)

pnpm db:up            # PostgreSQL (Docker)   -> localhost:5433
pnpm db:generate      # regenerar cliente Prisma
pnpm db:migrate       # crear/aplicar migración
pnpm db:seed          # sembrar permisos, features, plan/tenant de desarrollo (idempotente)
pnpm db:studio        # Prisma Studio
pnpm db:down          # apagar PostgreSQL

pnpm dev:api          # backend NestJS   -> http://localhost:4000/api
pnpm dev:web          # frontend Next.js -> http://localhost:3000
pnpm dev             # web + api + watchers de packages en paralelo

pnpm build           # db:generate + build de packages y apps
pnpm lint            # oxlint (api, packages) + eslint (web)
pnpm typecheck       # tsc --noEmit en todo el workspace
pnpm test            # tests (vitest en api)
pnpm format          # prettier --write .
```

Healthcheck del backend: `GET http://localhost:4000/api/health`
-> `{ "status": "ok", "db": "up" }` cuando PostgreSQL responde.

`AUTH_SECRET` (PowerShell):
`[Convert]::ToBase64String((1..32 | % { Get-Random -Max 256 }))`