# Dynamic Admin Dashboard

A fully **schema-driven admin dashboard** built with Next.js. Nothing is
hardcoded: the sidebar menu, list tables, create/edit forms, and data sources
are all configured at runtime through builder UIs and stored in the
dashboard's own database. The actual business data lives in **your** external
API — the dashboard talks to it through a small, documented contract, so the
same dashboard can be reused across any project.

## How it works

| Plane | What it holds | Where |
|---|---|---|
| **Config** | Menus, resources, field definitions, users/roles, API connections | This app's database (Prisma + SQLite by default) |
| **Data** | The records being managed (products, orders, …) | Your external API, called via `/api/proxy` |

One `FieldDefinition` drives both the form input *and* the table column for a
field. Connection secrets are AES-256-GCM encrypted at rest and only ever
attached to requests server-side.

## Quick start

```bash
npm install
npx prisma migrate dev      # creates prisma/dev.db
npx prisma db seed          # admin user + demo "Products" resource
npm run dev
```

Open http://localhost:3000 and sign in with the seeded admin
(`admin@example.com` / `admin1234` by default — change via `.env`).

The seed wires a **Products** resource to the bundled mock API
(`/api/mock/products`), so the full flow — dynamic menu → generated table →
generated form → CRUD — works out of the box with zero external setup.

## Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string (`file:./dev.db` by default) |
| `AUTH_SECRET` | NextAuth JWT secret (`openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | 64-char hex key for connection secrets (`openssl rand -hex 32`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | First super admin |
| `APP_URL` | Base URL used by the seed for the mock connection |

## Connect your own API in 5 minutes

1. Implement the contract in your backend — endpoints, list query params, and
   the `{ success, data, meta, error }` envelope. Full spec with an Express
   example lives at **`/docs`** inside the app.
2. **Settings → Connections → New connection**: enter your base URL and auth
   (bearer token / API key header / basic). Use **Test** to validate the
   envelope.
3. **Settings → Resources → New resource**: name it, pick the connection,
   confirm the endpoint paths.
4. On the **Fields** tab, define fields once — type, validation, conditional
   visibility, table format. Drag to reorder; check the **Form preview** tab.
5. **Settings → Menu**: add the resource to the sidebar.

Your team now has a list page with server-side pagination/sorting/filtering/
search, a validated create/edit form, a detail view, role-gated actions, and
an activity log — all generated from config.

## Features

- **Dynamic menu builder** — groups, nesting, icons, per-role visibility, drag-and-drop
- **Resource builder** — endpoints per CRUD op, capability toggles, minimum role per operation
- **Form builder** — 19 field types (text, number, select, relation, JSON, color, …),
  runtime Zod validation, conditional visibility, half/third widths, live preview
- **Table builder** — per-field column toggle, sortable/filterable flags,
  formats (badge with color map, currency, date, image thumb, link, …)
- **RBAC** — SUPER_ADMIN / ADMIN / EDITOR / VIEWER hierarchy enforced in the
  proxy, server actions, and UI
- **Server-side proxy** — secrets never reach the browser; inline mapping of
  server `VALIDATION_ERROR.fields` onto form inputs
- **Activity log** — every create/update/delete and config change
- **Workspace export/import** — move the whole configuration between
  deployments as JSON (secrets excluded by design)
- **Mock API** — `/api/mock/*` reference implementation of the contract

## Stack

Next.js (App Router) · TypeScript · Prisma · NextAuth v5 · Tailwind +
shadcn/ui · TanStack Table & Query · React Hook Form + Zod · dnd-kit

## Roles

| Role | Can |
|---|---|
| `VIEWER` | View resources (per resource permissions) |
| `EDITOR` | + create / update records (default resource permissions) |
| `ADMIN` | + delete records, manage connections/resources/menu, view activity |
| `SUPER_ADMIN` | + manage users, import workspaces |

## Production notes

- Switch `DATABASE_URL` to PostgreSQL and change the `provider` in
  `prisma/schema.prisma` to `postgresql`, then run `prisma migrate dev`.
- The mock API store is in-memory and resets on restart — it's for demos and
  contract testing only.
- `FILE` / `IMAGE` fields currently accept URLs; direct upload endpoints are a
  planned extension of the contract.
