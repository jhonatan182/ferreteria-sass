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
  api/    NestJS + TypeScript (ESM) + Prisma                         -> @ferreteria/api
packages/
  config/      tsconfig / prettier / oxlint compartidos             -> @ferreteria/config
  types/       contratos de tipos, sin runtime                      -> @ferreteria/types
  validation/  esquemas zod runtime (uuid, dinero, cantidad, ...)    -> @ferreteria/validation
prisma/
  schema.prisma   solo datasource + generator (sin modelos todavía)
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
cp .env.example .env   # y completar AUTH_SECRET

pnpm db:up            # PostgreSQL (Docker)   -> localhost:5433
pnpm db:generate      # regenerar cliente Prisma
pnpm db:migrate       # crear/aplicar migración (cuando existan modelos)
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