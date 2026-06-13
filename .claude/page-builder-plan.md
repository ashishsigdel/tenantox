# Plan: Multi-Tenant SaaS + Page Customization Overhaul

> Status: PLANNING (no code written yet). Owner: ashishsigdel.
> The DB is disposable (site is hours old) — a clean schema redesign is acceptable.

## 1. Where we are today (single-tenant)

- **Auth** (`src/auth.ts`): NextAuth Credentials, JWT. `User` has one **global** `role`
  (`SUPER_ADMIN | ADMIN | EDITOR | VIEWER`). No registration flow — login only.
- **Everything is global**: one shared set of `ApiConnection`, `Resource` (+ `FieldDefinition`),
  `Page` (+ `Block`), `MenuItem`. Slugs are globally unique.
- **Guard** (`src/server/guard.ts`): `requireRole(min)` checks the global role only.
- **"Workspace"** today (`src/server/actions/workspace.ts`) = an export/import JSON of the whole
  deployment's config. It is **not** a tenancy boundary.
- **Page builder**: relational `Block` rows, flat vertical 6-col layout, instant publish
  (`revalidatePath`), abstract list builder (no WYSIWYG), per-block config in a Sheet.

To become a SaaS ("anyone can register and use"), a **real tenant boundary** must sit under
everything, and the page builder is redesigned on top of it.

---

## 2. Target architecture

Two intertwined tracks:

- **Track A — Multi-tenancy (foundation, Phase 0).** A `Workspace` (tenant) owns all config.
  Users join workspaces via `Membership` with a per-workspace role. Registration creates a
  personal workspace. Every query is workspace-scoped; the session carries the active workspace.
- **Track B — Page customization overhaul (Phases 1–6).** Layout moves from a relational `Block`
  table to a **versioned JSON document tree**, enabling nesting, WYSIWYG, draft/publish,
  templates, and interactivity — all workspace-scoped.

---

## 3. Phase 0 — Multi-tenancy foundation (do first; everything depends on it)

### 3.1 Tenancy model: Workspace + Membership

Decision: **workspace-based** tenancy (teams), not bare per-user. Each registrant gets a personal
workspace automatically; they can invite others. The existing `Role` enum becomes the
**per-workspace** role (moved off `User`).

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique          // used for tenant routing / subdomain
  plan      Plan     @default(FREE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships  Membership[]
  connections  ApiConnection[]
  resources    Resource[]
  pages        Page[]
  menuItems    MenuItem[]
  activityLogs ActivityLog[]
}

model Membership {
  id          String   @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  role        Role     @default(VIEWER)   // per-workspace role
  createdAt   DateTime @default(now())

  @@unique([userId, workspaceId])
}

enum Plan { FREE PRO }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  isActive     Boolean  @default(true)
  isPlatformAdmin Boolean @default(false)   // SaaS operator, not a tenant role
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  memberships  Membership[]
  activityLogs ActivityLog[]
}
```

- `User.role` is **removed** (replaced by `Membership.role`). `isPlatformAdmin` is for *us*, the
  SaaS operator (support/superadmin console), not for tenant permissions.
- Keep the `Role` enum (`SUPER_ADMIN | ADMIN | EDITOR | VIEWER`) but rename semantics:
  `SUPER_ADMIN` = workspace owner.

### 3.2 Scope every config model to a workspace

Add `workspaceId` (FK, indexed) to `ApiConnection`, `Resource`, `Page`, `MenuItem`,
`ActivityLog`. `FieldDefinition`/`Block` inherit scope through their parent.

**Slugs become unique per-workspace, not global:**
- `Resource`: `@@unique([workspaceId, slug])`
- `Page`: `@@unique([workspaceId, slug])`
- This touches `src/lib/pages.ts` (`getPageDef(slug)` → `getPageDef(workspaceId, slug)`),
  `src/lib/resources.ts`, and all `findUnique({ where: { slug } })` call sites.

### 3.3 Auth, registration, session

- **Registration** `/register` + `registerUser` action: create `User`, a personal `Workspace`,
  and an owner `Membership` in one transaction; sign in.
- **Session/JWT** (`src/auth.ts`): carry `activeWorkspaceId` + the role *within* that workspace.
  On login, default to the user's first/most-recent membership. Update
  `src/types/next-auth.d.ts` accordingly.
- **Workspace switcher** in the dashboard shell; a `switchWorkspace(id)` action re-mints the JWT
  (verify membership first).
- **Invitations** (Phase 0.5, optional-but-likely): `Invitation` model (email + workspaceId +
  role + token), accept flow that creates a membership.

### 3.4 Tenant-scoped guard & data isolation (the critical security property)

- Rewrite `requireRole` → **`requireWorkspaceRole(min)`**: reads `activeWorkspaceId` from session,
  loads the membership, checks `hasRole(membership.role, min)`, returns
  `{ session, workspaceId, role }`. Throws `ForbiddenError` if not a member.
- **Every** server action and loader must filter by `workspaceId`. Introduce a helper
  (e.g. `scoped(workspaceId)` returning pre-filtered query builders, or a lint/review checklist)
  so no query forgets the tenant filter. **A missing filter = cross-tenant data leak.**
- The data proxy routes (`/api/proxy`, `/api/proxy/block`, `/api/proxy/preview`) must resolve the
  resource/connection **within the caller's workspace** and reject anything outside it. Today they
  trust a global slug/id — this must become workspace-scoped or it's a tenant-isolation hole.
- `logConfigChange` / `ActivityLog` gain `workspaceId`.

### 3.5 Routing for tenants

- **Builder/dashboard**: `activeWorkspaceId` comes from the session — no URL change needed.
- **Rendered custom pages**: pick one (recommend path-prefix now, subdomains later):
  - Path: `/w/[workspaceSlug]/p/[slug]` (simple, no DNS work).
  - Subdomain: `acme.app.com/p/[slug]` (nicer; needs wildcard DNS + middleware host parsing).
  - For now keep pages **members-only** (auth-gated). True public/anonymous published pages =
    later opt-in flag (`Page.isPublic`).

### 3.6 Plan limits (light, optional)

Enforce per-`Plan` caps (e.g. FREE: N workspaces members, N pages, N connections) in the create
actions. Keep it a thin guard; full billing (Stripe) is out of scope for this plan.

---

## 4. Page builder data model (Track B) — workspace-scoped JSON tree

Replace the relational `Block` table with a **versioned JSON layout tree** on `Page`.

```prisma
model Page {
  id          String     @id @default(cuid())
  workspaceId String
  workspace   Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name        String
  slug        String
  icon        String?
  description String?
  status      PageStatus @default(DRAFT)   // DRAFT | PUBLISHED
  isPublic    Boolean    @default(false)    // anonymous access (later)
  access      Json?      // Role[] allow-list within the workspace; null = all members
  appearance  Json?      // { maxWidth, gap, padding, cover, background, theme }
  seo         Json?      // { title, description, ogImage }
  params      Json?      // [{ key, label, source: "path"|"query" }] → dynamic pages
  draft       Json       // LayoutNode tree (builder edits this)
  published   Json?      // LayoutNode tree served publicly; null until first publish
  publishedAt DateTime?
  versions    PageVersion[]
  menuItems   MenuItem[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([workspaceId, slug])
}

model PageVersion {
  id        String   @id @default(cuid())
  pageId    String
  page      Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  label     String?
  snapshot  Json     // full LayoutNode tree
  createdBy String?
  createdAt DateTime @default(now())
}

enum PageStatus { DRAFT PUBLISHED }
```

The `Block` table is **dropped**. `BlockType` enum stays and expands.

### 4.1 Types (`src/types/meta.ts`)

Recursive node tree (keep all existing per-block config interfaces — they are good):

```ts
type LayoutNode = SectionNode | BlockNode;

interface SectionNode {            // layout container (enables nesting)
  id: string; kind: "section";
  columns: 1|2|3|4|6; gap?: "sm"|"md"|"lg"; padding?: "none"|"sm"|"md"|"lg";
  background?: string; visibleToRoles?: Role[] | null;
  children: LayoutNode[];
}
interface BlockNode {              // leaf — replaces today's BlockDef
  id: string; kind: "block"; type: BlockType; span: 1|2|3|4|6;
  config: BlockConfig; dataSource: BlockDataSource | null;
  refreshMs?: number; emptyState?: string; visibleToRoles?: Role[] | null;
}
```

`PageDef` becomes `{ ...meta, appearance, params, root: SectionNode }`.

### 4.2 Data layer / actions (`src/lib/pages.ts`, `src/server/actions/pages.ts`)

- `savePageDraft(pageId, tree)` — one coarse action, validated by a recursive zod schema
  (`zLayoutNode`); the builder owns the tree client-side and autosaves (debounced).
  The per-block `saveBlock` / `reorderBlocks` / `deleteBlock` actions are **removed**.
- `publishPage(pageId)` — copy `draft → published`, set status, write `PageVersion`,
  revalidate the rendered route.
- `revertToVersion`, `duplicatePage`, `importPage`, `exportPage`.
- **`/api/proxy/block`** contract changes from `{ blockId }` (a DB row id) to
  `{ pageId, nodeId, vars, source: "draft"|"published" }`; load the page (scoped to workspace),
  walk the tree to the node, reuse `fetchRawSource` unchanged. Preserves the security property
  (request shape resolved server-side, never from the browser).

---

## 5. Page customization phases (on top of Phase 0)

**Phase 1 — Seamless WYSIWYG builder.** Replace the flat list (`page-builder-client.tsx`) with a
3-pane editor: live-preview **canvas** (reuse `BlockRenderer`), docked **inspector** (today's
`BlockEditorSheet` forms), **insert** palette with insert-at-position + duplicate + misconfig
badges. State = one `useReducer` over the tree + debounced autosave. Fix the
`setState`-in-render smell at `page-builder-client.tsx:144`. **Fill config gaps already in the
types**: chart series colors, stat `format`/`icon`, button `variant` + JSON `payload`, raw
`query` params + `{{var}}` helper.

**Phase 2 — Flexible layout.** `SectionNode` containers (rows/columns with gap/padding/bg,
nestable); `PageRenderer` becomes recursive. Page **appearance** settings (max-width, gap, cover,
background).

**Phase 3 — Draft / publish / versioning.** Builder edits `draft`; **Preview** renders draft;
public route renders `published`. **Publish** snapshots a `PageVersion`; **version history** with
one-click revert; "unpublished changes" indicator.

**Phase 4 — Interactivity & dynamic pages.** `{{var}}` plumbing already exists in
`block-fetch.ts` + `useBlockData(id, vars)`; wire up the sources: `Page.params` → URL path/query
vars (enables `/p/[slug]/[id]` detail pages); **control blocks** (select/date-range/search) feed a
`PageVarsContext` consumed by sibling blocks live; per-block `refreshMs` polling + `emptyState`.

**Phase 5 — More block types.** IMAGE, EMBED (sandboxed iframe + URL allow-list), standalone FORM
(reuse `resource-form`/`field-input`), LIST/CARDS, TABS/ACCORDION (section variants), SPACER.

**Phase 6 — Templates & portability.** Starter templates (workspace- or platform-level),
import/export page JSON (`zLayoutNode` validated), duplicate page/block via `structuredClone` +
fresh `nodeId`s.

---

## 6. Security checklist (multi-tenant — non-negotiable)

- [ ] Every Prisma read/write filters by `workspaceId` (resources, pages, connections, menu, logs).
- [ ] `requireWorkspaceRole` verifies membership before any mutation.
- [ ] Proxy routes (`/api/proxy*`) resolve targets **within the caller's workspace** only.
- [ ] `switchWorkspace` verifies membership before re-minting the JWT.
- [ ] Connection secrets stay encrypted and per-workspace; never cross tenants; never exported.
- [ ] Slug uniqueness is per-workspace (`@@unique([workspaceId, slug])`), not global.
- [ ] Rendered pages gate on membership role (and `isPublic` only when explicitly enabled).
- [ ] Plan limits enforced server-side in create actions.

---

## 7. Build order (each step shippable)

1. **[DONE] Phase 0a — Tenancy schema + auth**: Postgres; Workspace/Membership/Plan; `User.role`
   removed (now `Membership.role`) + `User.isPlatformAdmin`; `/register` + `registerUser`;
   session carries `activeWorkspaceId`; `requireWorkspaceRole`; workspace switcher in the topbar;
   `SessionProvider` added. Migration `init_multitenant` applied; seed creates a demo workspace.
2. **[DONE] Phase 0b — Scope all existing config** by workspace: every server action
   (connections/resources/fields/menu/pages/blocks/workspace import-export) and loader scoped via
   `workspaceId`, using ownership-checked `updateMany`/`deleteMany`; proxy routes
   (`/api/proxy`, `block`, `preview`) resolve targets within the caller's workspace; per-workspace
   slug uniqueness; admin "Users" page reworked into workspace **Members** (add/role/remove).
   Verified: `tsc --noEmit` clean, `next build` clean, seed runs.
3. **[DONE] Phase 1 layout backend** — `Block` table dropped; `Page.layout` JSON holds
   `{ version:1, root:{ id, kind:"section", children: BlockDef[] } }` (flat root section; nesting
   deferred to Phase 2). `savePageLayout(pageId, layout)` with recursive zod replaces
   saveBlock/deleteBlock/reorderBlocks. `/api/proxy/block` now resolves by `{ pageId, nodeId }`
   from the stored layout (same server-side-only security). `lib/pages.ts` `toPageLayout`/`findBlock`;
   `PageRenderer` reads `layout.root.children`; block components + `useBlockData`/`useBlockAction`
   take `(pageId, nodeId)`. Block ids are client-generated uuids. Migration `phase1_page_layout`.
4. **[DONE] Phase 1 builder** — `page-builder-client` rewritten: live-preview **canvas** in the real
   6-col grid (content blocks render live; data blocks show a labeled placeholder + misconfig badge),
   click-to-edit, drag reorder (rectSortingStrategy), duplicate, insert-below, `/` palette,
   **debounced autosave** via `savePageLayout` with a saving/saved/error indicator. `BlockEditorSheet`
   is now a pure editor returning a draft (no per-block server action). Config-gap fills added:
   button style, chart per-series color, stat per-metric format + icon, raw query-param editor.
   Verified: `tsc` clean, `next build` clean, JSON layout DB round-trip OK.
   Follow-ups: full live data preview for data blocks in the canvas (currently placeholders);
   refetch-on-config-change invalidation.
5. **[NEXT] Phase 2** sections/columns + appearance.
6. **Phase 3** draft/publish + versions.
7. **Phase 4** params + control blocks + polling.
8. **Phase 5** new block types.
9. **Phase 6** templates + import/export.

### Phase 0 follow-ups (deferred, low risk)
- `/onboarding` route (fallback when a user has zero memberships; today registration/seed always
  create one, so the redirect is currently unreachable).
- Email invitations for users without an account (today `addMember` requires an existing account).
- Resource create entry point (no list/new route existed pre-refactor; resources reachable via
  `/settings/resources/[id]`).

---

## 8. Open decisions

- **Tenant routing**: path-prefix (`/w/[slug]/p/[slug]`) now vs subdomains later? (Recommend path now.)
- **Invitations in Phase 0** or defer? (Recommend a minimal invite in 0.5.)
- **Relational vs JSON tree** for layout: plan assumes JSON tree (better for nesting/versioning/
  templates). If we keep relational `Block` rows, Phases 2–3 get clunkier — re-plan needed.
- **Billing**: plan limits only for now; Stripe out of scope.
</content>
</invoke>
