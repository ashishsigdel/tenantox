"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logConfigChange, requireWorkspaceRole } from "@/server/guard";
import { Prisma } from "@prisma/client";

/**
 * Workspace export/import: moves the full configuration (connections without
 * secrets, resources + fields, pages, menu) between deployments as one JSON
 * file. Pages and the menu's page links are optional in the schema so files
 * exported before pages were supported still import cleanly.
 */

export async function exportWorkspace(): Promise<string> {
  const { workspaceId } = await requireWorkspaceRole("ADMIN");

  const [connections, resources, pages, menuItems] = await Promise.all([
    prisma.apiConnection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.resource.findMany({
      where: { workspaceId },
      include: { fields: true, apiConnection: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.page.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { workspaceId },
      orderBy: { order: "asc" },
      include: {
        resource: { select: { slug: true } },
        page: { select: { slug: true } },
      },
    }),
  ]);

  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      connections: connections.map((c) => ({
        name: c.name,
        baseUrl: c.baseUrl,
        authType: c.authType,
        // Secrets are intentionally NOT exported.
      })),
      resources: resources.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        icon: r.icon,
        connectionName: r.apiConnection.name,
        endpoints: r.endpoints,
        primaryKeyField: r.primaryKeyField,
        titleField: r.titleField,
        capabilities: r.capabilities,
        permissions: r.permissions,
        fields: r.fields
          .sort((a, b) => a.order - b.order)
          .map(({ id: _id, resourceId: _rid, createdAt: _c, updatedAt: _u, ...field }) => field),
      })),
      pages: pages.map((p) => ({
        name: p.name,
        slug: p.slug,
        icon: p.icon,
        description: p.description,
        viewRole: p.viewRole,
        layout: p.layout,
      })),
      menu: menuItems.map((m) => ({
        label: m.label,
        icon: m.icon,
        type: m.type,
        order: m.order,
        resourceSlug: m.resource?.slug ?? null,
        pageSlug: m.page?.slug ?? null,
        href: m.href,
        parentLabel: m.parentId
          ? (menuItems.find((p) => p.id === m.parentId)?.label ?? null)
          : null,
        visibleToRoles: m.visibleToRoles,
      })),
    },
    null,
    2,
  );
}

const importSchema = z.object({
  version: z.literal(1),
  connections: z.array(
    z.object({
      name: z.string(),
      baseUrl: z.string(),
      authType: z.enum(["NONE", "BEARER_TOKEN", "API_KEY_HEADER", "BASIC"]),
    }),
  ),
  resources: z.array(
    z.object({
      id: z.string().optional(), // source workspace ID, used for layout rewriting
      name: z.string(),
      slug: z.string(),
      icon: z.string().nullable(),
      connectionName: z.string(),
      endpoints: z.unknown(),
      primaryKeyField: z.string(),
      titleField: z.string(),
      capabilities: z.unknown(),
      permissions: z.unknown(),
      fields: z.array(z.record(z.string(), z.unknown())),
    }),
  ),
  // Pages are optional so files exported before pages were supported still import.
  pages: z
    .array(
      z.object({
        name: z.string(),
        slug: z.string(),
        icon: z.string().nullable(),
        description: z.string().nullable(),
        viewRole: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "VIEWER"]),
        layout: z.unknown(),
      }),
    )
    .optional(),
  menu: z.array(
    z.object({
      label: z.string(),
      icon: z.string().nullable(),
      type: z.enum(["GROUP", "RESOURCE", "PAGE", "LINK", "DIVIDER"]),
      order: z.number(),
      resourceSlug: z.string().nullable(),
      // Optional for back-compat with exports that predate page linking.
      pageSlug: z.string().nullable().optional(),
      href: z.string().nullable(),
      parentLabel: z.string().nullable(),
      visibleToRoles: z.unknown(),
    }),
  ),
});

export type ImportCounts = {
  connections: number;
  resources: number;
  pages: number;
  menu: number;
};

export type ImportResult =
  | { ok: true; counts: ImportCounts; warnings?: string[] }
  | { ok: false; error: string };

export async function importWorkspace(json: string): Promise<ImportResult> {
  let userId: string;
  let workspaceId: string;
  try {
    ({ userId, workspaceId } = await requireWorkspaceRole("SUPER_ADMIN"));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not allowed" };
  }

  let parsed: z.infer<typeof importSchema>;
  try {
    parsed = importSchema.parse(JSON.parse(json));
  } catch {
    return { ok: false, error: "Not a valid workspace export file" };
  }

  try {
    // Connections: upsert by name within this workspace (secrets re-entered after).
    const connectionIds = new Map<string, string>();
    for (const conn of parsed.connections) {
      const existing = await prisma.apiConnection.findFirst({
        where: { workspaceId, name: conn.name },
      });
      const saved = existing
        ? await prisma.apiConnection.update({
            where: { id: existing.id },
            data: { baseUrl: conn.baseUrl, authType: conn.authType },
          })
        : await prisma.apiConnection.create({ data: { ...conn, workspaceId } });
      connectionIds.set(conn.name, saved.id);
    }

    // Resources: upsert by (workspace, slug); fields are replaced wholesale.
    // Build oldId→newId map so page layouts can be rewritten below, plus the
    // set of live resource IDs in this workspace so we can detect any layout
    // reference that fails to relink (e.g. exports that predate resource IDs).
    const resourceIdMap = new Map<string, string>();
    const validResourceIds = new Set<string>();
    let resourcesImported = 0;
    for (const res of parsed.resources) {
      const connectionId = connectionIds.get(res.connectionName);
      if (!connectionId) continue;
      const data = {
        name: res.name,
        slug: res.slug,
        icon: res.icon,
        apiConnectionId: connectionId,
        endpoints: res.endpoints as Prisma.InputJsonValue,
        primaryKeyField: res.primaryKeyField,
        titleField: res.titleField,
        capabilities: res.capabilities as Prisma.InputJsonValue,
        permissions: res.permissions as Prisma.InputJsonValue,
      };
      const existing = await prisma.resource.findUnique({
        where: { workspaceId_slug: { workspaceId, slug: res.slug } },
      });
      const saved = existing
        ? await prisma.resource.update({ where: { id: existing.id }, data })
        : await prisma.resource.create({ data: { ...data, workspaceId } });

      validResourceIds.add(saved.id);
      if (res.id && res.id !== saved.id) {
        resourceIdMap.set(res.id, saved.id);
      }

      await prisma.fieldDefinition.deleteMany({
        where: { resourceId: saved.id },
      });
      for (const field of res.fields) {
        await prisma.fieldDefinition.create({
          data: {
            ...(field as object),
            resourceId: saved.id,
          } as Prisma.FieldDefinitionUncheckedCreateInput,
        });
      }
      resourcesImported++;
    }

    // Collects layout references that point at a resource ID not present in
    // this workspace after rewriting, so a broken import surfaces instead of
    // silently producing "Resource not found" pages.
    const unresolvedRefs: { pageSlug: string; resourceId: string }[] = [];

    /** Rewrites old→new resource IDs in a layout and reports unresolved refs. */
    function rewriteLayout(pageSlug: string, layout: unknown): Prisma.InputJsonValue {
      let json = JSON.stringify(layout ?? null);
      for (const [oldId, newId] of resourceIdMap) {
        json = json.replaceAll(oldId, newId);
      }
      for (const match of json.matchAll(/"resourceId":\s*"([^"]+)"/g)) {
        const id = match[1];
        if (!validResourceIds.has(id)) {
          unresolvedRefs.push({ pageSlug, resourceId: id });
        }
      }
      return JSON.parse(json) as Prisma.InputJsonValue;
    }

    // Pages: upsert by (workspace, slug); menu items link to them by slug below.
    const pageIds = new Map<string, string>();
    for (const page of parsed.pages ?? []) {
      const data = {
        name: page.name,
        slug: page.slug,
        icon: page.icon,
        description: page.description,
        viewRole: page.viewRole,
        layout: rewriteLayout(page.slug, page.layout ?? Prisma.JsonNull),
      };
      const existing = await prisma.page.findUnique({
        where: { workspaceId_slug: { workspaceId, slug: page.slug } },
      });
      const saved = existing
        ? await prisma.page.update({ where: { id: existing.id }, data })
        : await prisma.page.create({ data: { ...data, workspaceId } });
      pageIds.set(page.slug, saved.id);
    }

    // Menu: replace this workspace's menu wholesale (config-only, safe to rebuild).
    await prisma.menuItem.deleteMany({ where: { workspaceId } });
    let menuImported = 0;
    const parentIds = new Map<string, string>();
    for (const item of parsed.menu.filter((m) => !m.parentLabel)) {
      const resource = item.resourceSlug
        ? await prisma.resource.findUnique({
            where: { workspaceId_slug: { workspaceId, slug: item.resourceSlug } },
          })
        : null;
      const created = await prisma.menuItem.create({
        data: {
          workspaceId,
          label: item.label,
          icon: item.icon,
          type: item.type,
          order: item.order,
          resourceId: resource?.id ?? null,
          pageId: item.pageSlug ? (pageIds.get(item.pageSlug) ?? null) : null,
          href: item.href,
          visibleToRoles: (item.visibleToRoles ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
      parentIds.set(item.label, created.id);
      menuImported++;
    }
    for (const item of parsed.menu.filter((m) => m.parentLabel)) {
      const resource = item.resourceSlug
        ? await prisma.resource.findUnique({
            where: { workspaceId_slug: { workspaceId, slug: item.resourceSlug } },
          })
        : null;
      await prisma.menuItem.create({
        data: {
          workspaceId,
          label: item.label,
          icon: item.icon,
          type: item.type,
          order: item.order,
          resourceId: resource?.id ?? null,
          pageId: item.pageSlug ? (pageIds.get(item.pageSlug) ?? null) : null,
          href: item.href,
          parentId: parentIds.get(item.parentLabel!) ?? null,
          visibleToRoles: (item.visibleToRoles ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
      menuImported++;
    }

    const counts: ImportCounts = {
      connections: connectionIds.size,
      resources: resourcesImported,
      pages: pageIds.size,
      menu: menuImported,
    };

    await logConfigChange(userId, workspaceId, {
      entity: "workspace",
      op: "import",
      ...counts,
    });
    revalidatePath("/dashboard", "layout");

    // Surface pages whose table/resource blocks couldn't be relinked. This
    // happens for files exported before resource IDs were included; those
    // blocks must be re-pointed manually (or re-exported from the new build).
    const warnings = unresolvedRefs.length
      ? [
          `${unresolvedRefs.length} page block(s) reference a resource that wasn't found and need re-linking in the page builder: ` +
            unresolvedRefs.map((r) => r.pageSlug).join(", "),
        ]
      : undefined;

    return { ok: true, counts, warnings };
  } catch (e) {
    console.error("importWorkspace failed", e);
    return {
      ok: false,
      error: e instanceof Error && e.message ? e.message : "Import failed",
    };
  }
}
