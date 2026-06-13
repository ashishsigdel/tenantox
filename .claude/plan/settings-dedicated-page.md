# Plan: Dedicated `/settings` page — unified settings hub with grouped sub-nav

## Goal
Add a single **Settings** entry to the main sidebar that opens `/settings`. The settings page is a two-panel hub: a left **grouped sub-nav** + a right content area that renders one section per route. Settings are organized into groups:

- **General** (personal, available to every signed-in user): Account, Security, Notifications, Appearance.
- **Dashboard** (customization/admin config, ADMIN only): the existing items — Connections, Resources, Menu, Users, Activity, API Docs.

Confirmed with the user:
- The existing 6 admin items **are** the "dashboard customization" group; keep them, just regroup them under the settings hub.
- New personal groups (Account, Security, Notifications, Appearance) sit alongside.
- Everything stays inside `/dashboard` (auth-gated). The prompt's `/settings` == `/dashboard/settings`.
- Build it "advanced" — add feasible sections; flag anything needing backend work.

## Pathing (decided)
Keep routes under `/dashboard/settings/*` (existing pages already live there, and auth/topbar/providers are inherited from `dashboard/layout.tsx`). Top-level bare `/settings` is **not** pursued (would duplicate auth + chrome). All paths below use `/dashboard/settings/*`.

---

## Current state (as-is)
- `src/components/layout/app-sidebar.tsx` — renders dynamic `menu` **and** a `SidebarFooter` list of the 6 settings links (`settingsLinks` prop).
- `src/app/dashboard/layout.tsx` — defines `SETTINGS_LINKS`, computes them ADMIN-only, passes `menu` + `settingsLinks` to `<AppSidebar>`.
- `src/app/dashboard/settings/layout.tsx` — blanket ADMIN gate, returns `<>{children}</>` (no UI).
- Existing settings pages: `connections`, `resources`, `menu`, `users`, `activity` (all `/dashboard/settings/*`). No settings index, no `api-docs` route (API Docs → `/docs`).
- Active "pill" style = `menuButtonVariants` `data-active:*` classes (`src/components/ui/sidebar.tsx:469`): `data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground data-active:shadow-soft data-active:ring-1 data-active:ring-sidebar-border`.
- Icons via `DynamicIcon` (kebab-case name → lucide).
- **Auth**: next-auth Credentials + `bcryptjs`, JWT sessions. `User` model = `id, email, passwordHash, name, role, isActive` (no avatar / notification / theme columns).
- **Theme**: `useTheme()` from `@/components/theme`, toggled in the topbar; not persisted server-side.

## Role model impact (important change)
Today `settings/layout.tsx` redirects **all** non-admins away from `/settings`. The new General group must be reachable by every signed-in user, while the Dashboard group stays ADMIN-only. So:
- `/dashboard/settings` (+ General sections) → any authenticated user.
- Dashboard group routes → ADMIN only, enforced by a nested route-group layout (below). The sub-nav also hides the Dashboard group for non-admins.

---

## Target route map
```
/dashboard/settings                      -> redirect to /dashboard/settings/account
General (all users):
  /dashboard/settings/account            -> NEW  (profile: name; email read-only)
  /dashboard/settings/security           -> NEW  (change password)
  /dashboard/settings/notifications      -> NEW  (scaffold; needs schema to persist)
  /dashboard/settings/appearance         -> NEW  (theme + UI prefs)
Dashboard (ADMIN only, existing pages moved under an (admin) route group):
  /dashboard/settings/connections        -> existing
  /dashboard/settings/resources          -> existing
  /dashboard/settings/menu               -> existing
  /dashboard/settings/users              -> existing
  /dashboard/settings/activity           -> existing
  API Docs                               -> external link to standalone /docs (NOT a settings route)
```
Route groups `(...)` don't change URLs, so existing links keep working after the move.

---

## Step-by-step implementation

### Step 1 — Strip settings out of the main sidebar
File: `src/components/layout/app-sidebar.tsx`
- Remove the `settingsLinks` prop, the `SettingsLink` interface, and the whole `<SidebarFooter>` settings block.
- Remove now-unused imports.

### Step 2 — Add the single "Settings" entry to the main sidebar
File: `src/components/layout/app-sidebar.tsx`
- Add one `SidebarMenuItem` → `SidebarMenuButton asChild isActive={isActive("/dashboard/settings")}` → `<Link href="/dashboard/settings">` with a `Settings`/`Settings2` icon + "Settings".
- Place it in a `SidebarFooter` (pinned to bottom, matches old position).
- **Visible to all signed-in users** (General settings are universal), so no role prop needed for the entry itself. (Admin-only sections are gated at the route + hidden in the sub-nav.)
- `isActive` uses `startsWith`, so "Settings" stays highlighted across `/dashboard/settings/*`.

### Step 3 — Build the grouped settings sub-nav component
New file: `src/components/layout/settings-nav.tsx` (`"use client"`), prop `{ isAdmin: boolean }`.
- Define groups + items locally:
  - **General**: Account `/account` `user`, Security `/security` `shield`, Notifications `/notifications` `bell`, Appearance `/appearance` `palette`.
  - **Dashboard** (render only if `isAdmin`): Connections `/connections` `plug`, Resources `/resources` `database`, Menu `/menu` `list-tree`, Users `/users` `users`, Activity `/activity` `history`, API Docs → `/docs` `book-open` (standalone route, opens outside the settings panel — keep as a normal `<Link href="/docs">`).
- `usePathname()` + `isActive(href)` = `pathname === href || pathname.startsWith(href + "/")` (keeps deep routes like `/resources/new` active).
- Render group label + vertical `<Link>` list. **Do not nest a second shadcn `<SidebarProvider>/<Sidebar>`** (one is already mounted at dashboard level; nesting breaks the context/tooltips). Replicate the pill look with the same utilities:
  - base: `flex w-full items-center gap-2 rounded-md p-2 text-sm transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`
  - active: `bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-soft ring-1 ring-sidebar-border`
  - group label: mirror `SidebarGroupLabel` (`px-2 text-xs font-medium text-sidebar-foreground/70`).
  - icon: `<DynamicIcon name={item.icon} className="size-4 shrink-0" />`.

### Step 4 — Turn the settings layout into the two-panel shell (and relax the gate)
File: `src/app/dashboard/settings/layout.tsx`
- Change the gate: require a session (redirect to `/login` if none) but **do not** redirect non-admins (General settings are for everyone). Compute `isAdmin = hasRole(session.user.role, "ADMIN")`.
- Render two-panel:
  - left `<aside class="w-56 shrink-0">` with a "Settings" header + `<SettingsNav isAdmin={isAdmin} />`
  - right `<div class="flex-1 min-w-0">{children}</div>`
  - wrapper `<div class="flex flex-col gap-6 md:flex-row">` (stacks on mobile).
- Use theme tokens (`bg-sidebar`, `border-sidebar-border`, `text-sidebar-foreground`) so it matches the main sidebar in dark mode.

### Step 5 — Protect the Dashboard (admin) group via a route group
- Create `src/app/dashboard/settings/(admin)/layout.tsx` that does the ADMIN gate (`if (!session?.user || !hasRole(role,"ADMIN")) redirect("/dashboard/settings")`).
- Move existing folders into it (URLs unchanged): `connections`, `resources`, `menu`, `users`, `activity` → `src/app/dashboard/settings/(admin)/...`. (API Docs is **not** a settings route — it links out to `/docs`.)
- Update any relative imports broken by the move (the `*-client.tsx` siblings move with their `page.tsx`, so sibling imports stay intact; only check imports that reference these by path).

### Step 6 — Settings index + new General pages
- `src/app/dashboard/settings/page.tsx` — `redirect("/dashboard/settings/account")`.
- **Account** `account/page.tsx` — server component reads `auth()`; client form to edit `name` (email shown read-only since it's the login key). Wire via a server action / `POST /api/.../account` that updates `prisma.user.update({ name })` for `session.user.id`. *(Avatar deferred — no column.)*
- **Security** `security/page.tsx` — change-password form: current + new + confirm. Server action verifies current via `bcrypt.compare` against `passwordHash`, then `bcrypt.hash` + `prisma.user.update`. Fully feasible with current schema/auth.
- **Appearance** `appearance/page.tsx` — surface the existing light/dark toggle (reuse `useTheme`) plus simple UI prefs (e.g., density) stored client-side for now. Server persistence optional (needs a prefs column).
- **Notifications** `notifications/page.tsx` — **scaffold only** (persistence deferred; see "Backend follow-ups"). Render the toggles disabled/no-op or with a "coming soon" note; no save wiring this pass.
- **API Docs** — no new route. The Dashboard sub-nav item is a plain `<Link href="/docs">` to the existing standalone docs page (leaves the settings panel). `src/app/docs/page.tsx` is untouched.

### Step 7 — Update the dashboard layout wiring
File: `src/app/dashboard/layout.tsx`
- Remove `SETTINGS_LINKS` and the `settingsLinks` computation.
- Render `<AppSidebar menu={menu} />` only (Settings entry is now internal to the sidebar).

---

## Files touched (summary)
| File | Change |
|------|--------|
| `src/components/layout/app-sidebar.tsx` | Remove footer settings list; add single "Settings" link (all users) |
| `src/components/layout/settings-nav.tsx` | **New** grouped client sub-nav (General + admin Dashboard), pill active style |
| `src/app/dashboard/settings/layout.tsx` | Two-panel shell; relax gate (auth-only, not admin-only) |
| `src/app/dashboard/settings/page.tsx` | **New** redirect → `/account` |
| `src/app/dashboard/settings/account/page.tsx` | **New** profile (name) |
| `src/app/dashboard/settings/security/page.tsx` | **New** change password |
| `src/app/dashboard/settings/appearance/page.tsx` | **New** theme + UI prefs |
| `src/app/dashboard/settings/notifications/page.tsx` | **New** scaffold (persistence pending) |
| `src/app/dashboard/settings/(admin)/layout.tsx` | **New** ADMIN gate for the Dashboard group |
| `connections, resources, menu, users, activity` | **Move** under `(admin)/` (URLs unchanged) |
| `src/app/dashboard/layout.tsx` | Drop `SETTINGS_LINKS`; pass only `menu` |

*(API Docs links to the existing standalone `/docs` — no new route, `src/app/docs/page.tsx` untouched.)*

## Backend follow-ups (deferred — NOT in this pass)
- **Skip the schema migration for now** (per decision). So **Notifications persistence**, **Appearance persistence (theme/density)**, and **Avatar** are out of scope this pass — no `UserPreference`/JSON column added. Those sections ship as UI scaffolds; theme still works client-side via `useTheme` (just not persisted server-side).
- Account (name update) and Security (password change via bcrypt) are fully wireable now with the existing schema.

## Verification checklist
- Main sidebar shows only dynamic nav + one "Settings" item; the 6 admin links are gone from it.
- "Settings" → `/dashboard/settings` → redirects to Account; works for non-admin users too.
- Settings page = left grouped sub-nav + right content; switching items swaps only the right panel.
- General group visible to everyone; Dashboard group visible **and** reachable only for admins (non-admin hitting `/dashboard/settings/users` is redirected).
- Active item shows the dark rounded-pill highlight; deep routes (e.g. `/resources/new`) keep "Resources" active.
- Account name save + Security password change work end-to-end.
- Dark theme, fonts, icons match the main sidebar; existing admin URLs still resolve after the `(admin)` move.
- `npm run build` / lint pass; no unused imports.

## Open / optional (future scope, not this pass)
- "Advanced" extras: Sessions/devices list, API keys/tokens, Language & Region, Billing — all need backend.
- Notifications/Appearance persistence + Avatar — revisit once a `UserPreference` schema is added.
