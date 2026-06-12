# Build Prompt: Dynamic Schema-Driven Admin Dashboard

Use this prompt (in full or phase by phase) to build the project.

---

## 1. Project Overview

Build a **fully dynamic, schema-driven admin dashboard** in Next.js. Nothing about the dashboard is hardcoded: the sidebar menu, the list tables, the create/edit forms, and the data sources are all defined by the admin user at runtime through builder UIs, and stored as configuration in the dashboard's own database.

The actual business data (products, orders, blog posts, etc.) is **not** stored in the dashboard. It lives in an **external API** belonging to whatever project the dashboard is connected to. The dashboard calls that API dynamically, following a documented request/response contract. Any backend that implements the contract works with the dashboard with zero dashboard code changes.

Think of it as a self-hosted, reusable mix of Retool + Strapi's admin: a generic admin panel you can point at any project.

### Two data planes (critical architecture rule)

| Plane | What it holds | Where it lives |
|---|---|---|
| **Config plane** | Menus, resources, field definitions, table configs, users/roles, API connection settings | Dashboard's own database (Prisma + PostgreSQL) |
| **Data plane** | The actual records being managed (CRUD targets) | External API of the consuming project |

The dashboard's Next.js route handlers serve the config plane. The browser (via a server-side proxy route for auth/secrets) talks to the data plane.

---

## 2. Tech Stack

- **Next.js 15+ (App Router, TypeScript)**
- **Prisma + PostgreSQL** for the config database (use SQLite for local dev if convenient)
- **Tailwind CSS + shadcn/ui** for all UI components
- **TanStack Table** for the dynamic data tables
- **React Hook Form + Zod** for dynamic form rendering and validation (Zod schemas generated at runtime from field definitions)
- **TanStack Query** for data-plane fetching, caching, and mutation state
- **Auth.js (NextAuth)** with credentials provider, JWT sessions, and role-based access control
- **dnd-kit** for drag-and-drop in the form/menu builders
- **lucide-react** for icons (icon names stored as strings in config)

---

## 3. Config Database Schema (Prisma)

Model the meta-schema with these entities:

### `User`
id, email, passwordHash, name, role (`SUPER_ADMIN` | `ADMIN` | `EDITOR` | `VIEWER`), isActive, timestamps.

### `ApiConnection`
A reusable external API target.
- id, name, baseUrl
- authType: `NONE` | `BEARER_TOKEN` | `API_KEY_HEADER` | `BASIC`
- authConfig (encrypted JSON: token / header name + key / username + password)
- defaultHeaders (JSON)

### `Resource`
One manageable entity type (e.g. "Products").
- id, name, slug (unique, used in URLs: `/dashboard/r/[slug]`)
- apiConnectionId → ApiConnection
- endpoints (JSON): `{ list, getOne, create, update, delete }` — paths relative to baseUrl, supporting `{id}` placeholder, each with HTTP method (so `update` can be PUT or PATCH)
- primaryKeyField (default `"id"`), titleField (which field labels a record)
- capabilities (JSON): `{ create: true, update: true, delete: true, view: true }` — toggles which CRUD operations are exposed
- permissions (JSON): minimum role per operation
- softDelete flag, timestamps

### `FieldDefinition`
One field of a resource (drives both forms and tables).
- id, resourceId → Resource, key (the JSON property name in API payloads), label, order
- type: `TEXT` | `TEXTAREA` | `RICH_TEXT` | `NUMBER` | `BOOLEAN` | `DATE` | `DATETIME` | `SELECT` | `MULTI_SELECT` | `RADIO` | `EMAIL` | `URL` | `PASSWORD` | `FILE` | `IMAGE` | `JSON` | `RELATION` | `COLOR` | `SLUG`
- config (JSON, type-specific):
  - SELECT/MULTI_SELECT/RADIO: static `options: [{label, value}]` **or** dynamic `optionsSource: { resourceSlug, valueField, labelField }` (options fetched from another resource's list endpoint)
  - RELATION: `{ resourceSlug, valueField, labelField, multiple }` — rendered as a searchable async select
  - NUMBER: min, max, step; TEXT: minLength, maxLength, regex pattern; FILE/IMAGE: accept, maxSizeMB, uploadEndpoint
- validation (JSON): required, unique hint, custom error messages
- form settings: showInForm, placeholder, helpText, defaultValue, readOnly, width (`full` | `half` | `third`)
- conditional visibility (JSON): `{ field, operator: eq|neq|in|truthy, value }` — show this field only when another field matches
- table settings: showInTable, sortable, filterable, tableOrder, format (`text` | `badge` | `date` | `datetime` | `currency` | `boolean-icon` | `image-thumb` | `truncate` | `link`), badgeColorMap (JSON value→color)

### `MenuItem`
- id, label, icon (lucide name), order, parentId (nullable, for groups/nesting)
- type: `GROUP` | `RESOURCE` | `LINK` | `DIVIDER`
- resourceId (when type=RESOURCE), href (when type=LINK), visibleToRoles (JSON array)

### `ActivityLog`
id, userId, action (`CREATE`|`UPDATE`|`DELETE`|`CONFIG_CHANGE`), resourceSlug, recordId, payload snapshot (JSON), createdAt.

---

## 4. The External API Contract (Data Plane)

This contract is what consuming projects must implement. It must also be published as a documentation page inside the dashboard (`/docs`).

### Endpoints (paths configurable per resource; these are the recommended defaults)

```
GET    {baseUrl}/{resource}            # list
GET    {baseUrl}/{resource}/{id}       # get one
POST   {baseUrl}/{resource}            # create
PUT    {baseUrl}/{resource}/{id}       # update (or PATCH, per config)
DELETE {baseUrl}/{resource}/{id}       # delete
```

### List query parameters (dashboard always sends these)

```
?page=1                      # 1-based page number
&pageSize=10                 # rows per page
&sort=-createdAt             # field name, "-" prefix = descending
&search=keyword              # free-text search (backend decides which fields)
&filter[status]=active       # per-field equality filters, repeatable
&filter[price][gte]=100      # operator filters: gte, lte, gt, lt, ne, like, in
```

### Response envelope (every endpoint, success)

```json
{
  "success": true,
  "data": { ... } | [ ... ],
  "meta": { "page": 1, "pageSize": 10, "total": 142, "totalPages": 15 }
}
```
`meta` is required for list responses, omitted elsewhere. `data` is an array for list, an object for getOne/create/update, and `null` for delete.

### Response envelope (error)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": { "email": "Email is already taken", "price": "Must be positive" }
  }
}
```
Standard codes: `VALIDATION_ERROR` (422), `NOT_FOUND` (404), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `INTERNAL_ERROR` (500). When `fields` is present on create/update errors, the dashboard maps each message onto the matching form field inline.

### Auth
The dashboard attaches credentials from the resource's ApiConnection (bearer token, API-key header, or basic auth) to every data-plane request. All data-plane requests go through a server-side proxy route (`POST /api/proxy`) so secrets never reach the browser. The proxy validates that the requesting dashboard user's role permits the operation on that resource before forwarding.

---

## 5. Application Pages & Features

### Auth
- `/login` — credentials login; seed a SUPER_ADMIN from env vars on first run
- Middleware-protected `/dashboard/**`; role checks on every config mutation

### Dashboard shell
- Collapsible sidebar rendered entirely from `MenuItem` config (groups, nesting, icons, role-filtered)
- Topbar: breadcrumbs, global search across resources, user menu, dark/light mode toggle

### Dynamic resource pages (the core)
- `/dashboard/r/[slug]` — **list page**, fully generated from config:
  - TanStack Table with server-side pagination, sorting, per-column filters, search box — all translated into the contract's query params
  - Cell rendering per the field's `format` (badges, image thumbs, currency, dates…)
  - Row actions (view / edit / delete with confirm dialog), bulk select + bulk delete
  - Column visibility toggle, page-size selector
  - Buttons appear only if the resource's `capabilities` + the user's role allow them
- `/dashboard/r/[slug]/new` and `/dashboard/r/[slug]/[id]/edit` — **dynamic form**:
  - Rendered from FieldDefinitions: correct input component per type, layout by `width`, conditional visibility rules evaluated live
  - Zod schema built at runtime from each field's validation config; client-side errors inline
  - Server `VALIDATION_ERROR.fields` mapped back onto form fields
  - RELATION and dynamic SELECT fields load options from the related resource's list endpoint (searchable async combobox)
- `/dashboard/r/[slug]/[id]` — read-only detail view

### Builder pages (SUPER_ADMIN / ADMIN only)
- `/dashboard/settings/connections` — CRUD for ApiConnections, with a "Test connection" button that pings the list endpoint and validates the response envelope
- `/dashboard/settings/resources` — resource list + a multi-step **Resource Builder**:
  1. Basics: name, slug, connection, endpoints, capabilities, permissions
  2. **Form/Field Builder**: drag-and-drop field list (dnd-kit), add/edit fields in a side panel with type-specific config UIs, live form preview pane
  3. **Table Builder**: choose visible columns, order, format, sortable/filterable flags, live table preview with mock rows
- `/dashboard/settings/menu` — drag-and-drop menu builder with nesting, icon picker, role visibility; live sidebar preview
- `/dashboard/settings/users` — manage dashboard users and roles
- `/dashboard/settings/activity` — activity log viewer

### Home & docs
- `/dashboard` — overview: per-resource record counts (from list `meta.total`), recent activity
- `/docs` — built-in documentation of the API contract (Section 4), with copy-paste examples and a sample Express/Nest reference implementation snippet

### Import/export
- Export a resource's full config (or the whole workspace) as JSON; import it into another deployment — this is what makes the dashboard reusable across projects.

---

## 6. Engineering Requirements

- TypeScript strict mode; shared types for the meta-schema and the API envelope in a `types/` module
- A single `DataProvider` layer encapsulating all data-plane calls (build query strings, unwrap envelopes, normalize errors) — components never call `fetch` directly
- A `FieldRenderer` registry: `Record<FieldType, { FormInput, TableCell, configPanel }>` so new field types are added in one place
- Config-plane route handlers under `/api/admin/**` with Zod-validated bodies and role guards
- Encrypt ApiConnection secrets at rest (AES-256-GCM with a key from env)
- Optimistic-free, honest mutation states: loading, success toast, inline server errors
- Seed script: demo SUPER_ADMIN, one demo ApiConnection pointing at a bundled mock API, and one fully configured "Products" resource so the app demos out of the box
- Bundled **mock external API** (route handlers under `/api/mock/**` with an in-memory store) implementing the full contract — used for the seed demo and contract tests
- README covering setup, env vars, and a "connect your own API in 5 minutes" guide

---

## 7. Build Order (phases)

1. **Foundation**: Next.js scaffold, Prisma schema, auth, dashboard shell with static placeholder menu
2. **Config plane**: ApiConnections + Resource/Field CRUD APIs and basic (non-drag) builder UIs; mock external API + seed
3. **Dynamic list page**: DataProvider, proxy route, TanStack Table generated from config with pagination/sort/filter/search
4. **Dynamic forms**: runtime Zod generation, all field types, conditional visibility, create/edit/detail pages, server error mapping
5. **Builders polish**: drag-and-drop form builder with live preview, table builder, menu builder, icon picker
6. **RBAC + activity log + import/export**
7. **Docs page, README, contract test suite against the mock API**

Each phase must end in a state where `npm run dev` works and the seeded demo flow (login → see Products in menu → list → create → edit → delete) is functional to the extent that phase allows.
