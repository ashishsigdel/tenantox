# Repository Guidelines

## Project Overview

A **schema-driven Next.js (App Router) admin dashboard**. Nothing is hardcoded: the sidebar menu, list tables, create/edit forms, and data sources are configured at runtime through builder UIs and stored in the app's own database. The records being managed live in an **external API** reached through a documented contract, so the same dashboard is reusable across projects. Stack: Next.js 16 · TypeScript · Prisma · NextAuth v5 · Tailwind + shadcn/ui · TanStack Table & Query · React Hook Form + Zod · dnd-kit.

## Development Commands

```bash
npm install
npx prisma migrate dev   # create/apply migrations to prisma/dev.db
npm run seed             # admin user + demo "Products" resource (prisma db seed → tsx prisma/seed.ts)
npm run dev              # http://localhost:3000
npm run build            # production build
npm run start            # serve the production build
npm run lint             # eslint
```

There is **no test runner configured** — do not invent `npm test`. Contract checking is done manually against the bundled mock API.

## Architecture

**Two planes.** *Config plane* — menus, resources, `FieldDefinition`s, users/roles, connections — lives in this app's Prisma DB (SQLite default), edited via builder UIs under `src/app/dashboard/settings/*` and persisted by server actions in `src/server/actions/*`. *Data plane* — actual records — lives in an external API the browser never calls directly: client code uses `src/lib/data-provider.ts` (TanStack Query) → POST `src/app/api/proxy/route.ts`, which attaches connection secrets server-side and forwards.

One `FieldDefinition` drives both the form input and the table column. Runtime rendering: `src/components/resource/*`. Build-time editors: `src/components/builder/*`. `src/components/ui/*` is shadcn/ui. Resource pages at `src/app/dashboard/r/[slug]/*`; built-in contract docs at `src/app/docs`. Shared helpers in `src/lib/*` (`form-schema.ts` builds runtime Zod, `crypto.ts` AES-256-GCM, `roles.ts`, `prisma.ts`).

DB schema (`prisma/schema.prisma`):

| Model | Holds |
|---|---|
| `User` | email, passwordHash, name, `Role`, isActive |
| `ApiConnection` | baseUrl, `AuthType`, encrypted `authConfig`, defaultHeaders → has many Resource |
| `Resource` | name, unique slug, endpoints/capabilities/permissions (JSON), pk/title field → ApiConnection, has FieldDefinitions & MenuItems |
| `FieldDefinition` | key, label, `FieldType`, config/validation (JSON), form + table settings, `visibleIf` — unique `[resourceId, key]` |
| `MenuItem` | label, icon, `MenuItemType`, self-nesting parent/children, visibleToRoles → Resource |
| `ActivityLog` | userId, `ActivityAction`, resourceSlug, recordId, detail |

Key enums: `Role`, `AuthType`, `FieldType` (19 types), `MenuItemType`, `ActivityAction`.

## Conventions

- TypeScript `strict`; import via the `@/*` alias (`@/lib`, `@/server`, `@/components`).
- Files are **kebab-case**; client components marked `"use client"`.
- ESLint = `eslint-config-next` (core-web-vitals + typescript); run `npm run lint` before committing.
- All mutations go through server actions wrapped in `runAction` and gated by `requireRole(...)` from `src/server/guard.ts`; validate with Zod. Do **not** call Prisma from route handlers directly.
- RBAC hierarchy `SUPER_ADMIN > ADMIN > EDITOR > VIEWER`, enforced in the proxy, server actions, and UI.
- Commits: history is a single initial scaffold, so no convention is established — use short imperative subjects and keep schema changes paired with their generated `prisma/migrations/` files.

## Environment Variables

Set in `.env` (never commit values):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string (`file:./dev.db` by default) |
| `AUTH_SECRET` | NextAuth JWT secret |
| `ENCRYPTION_KEY` | 64-char hex key for connection-secret encryption |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | First super admin created by the seed |
| `APP_URL` | Base URL used by the seed for the mock connection |

## Known Gotchas

- `src/proxy.ts` is the Next.js 16 **middleware** (auth redirects) — distinct from the `/api/proxy` **data route**. Easy to confuse; they are unrelated.
- `src/components/ui/*` is shadcn/ui — regenerate via the CLI, **do not hand-edit**.
- `src/app/api/mock/*` is a reference implementation of the external API contract (`_contract.ts`), used by the seed so CRUD works with zero external setup. Its store is **in-memory and resets on restart** — demos/contract testing only, not persistence.
- Connection secrets are AES-256-GCM encrypted at rest (`src/lib/crypto.ts`) and only attached server-side; a changed `ENCRYPTION_KEY` makes existing secrets undecryptable.
- Switching to Postgres means changing `provider` in `prisma/schema.prisma` and re-running `prisma migrate dev`.

## Current Focus

Initial scaffold with the core builders, two-plane architecture, RBAC, and mock API implemented and demoing out of the box (login → Products in menu → list → create → edit → delete). Build order is phased in `Prompt.md`; per the README production notes, the next planned extension is **direct file/image upload endpoints** — `FILE`/`IMAGE` fields currently accept URLs only — plus the contract-test suite against the mock API.
