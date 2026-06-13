"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  logConfigChange,
  requireWorkspaceRole,
  runAction,
  type ActionResult,
} from "@/server/guard";
import { Prisma } from "@prisma/client";

/**
 * Workspace export/import: moves the full configuration (connections without
 * secrets, resources + fields, menu) between deployments as one JSON file.
 */

export async function exportWorkspace(): Promise<string> {
  const { workspaceId } = await requireWorkspaceRole("ADMIN");

  const [connections, resources, menuItems] = await Promise.all([
    prisma.apiConnection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.resource.findMany({
      where: { workspaceId },
      include: { fields: true, apiConnection: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { workspaceId },
      orderBy: { order: "asc" },
      include: { resource: { select: { slug: true } } },
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
      menu: menuItems.map((m) => ({
        label: m.label,
        icon: m.icon,
        type: m.type,
        order: m.order,
        resourceSlug: m.resource?.slug ?? null,
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
  menu: z.array(
    z.object({
      label: z.string(),
      icon: z.string().nullable(),
      type: z.enum(["GROUP", "RESOURCE", "LINK", "DIVIDER"]),
      order: z.number(),
      resourceSlug: z.string().nullable(),
      href: z.string().nullable(),
      parentLabel: z.string().nullable(),
      visibleToRoles: z.unknown(),
    }),
  ),
});

export async function importWorkspace(json: string): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("SUPER_ADMIN");

    let parsed: z.infer<typeof importSchema>;
    try {
      parsed = importSchema.parse(JSON.parse(json));
    } catch {
      throw new Error("Not a valid workspace export file");
    }

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
    }

    // Menu: replace this workspace's menu wholesale (config-only, safe to rebuild).
    await prisma.menuItem.deleteMany({ where: { workspaceId } });
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
          href: item.href,
          visibleToRoles: (item.visibleToRoles ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
      parentIds.set(item.label, created.id);
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
          href: item.href,
          parentId: parentIds.get(item.parentLabel!) ?? null,
          visibleToRoles: (item.visibleToRoles ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    }

    await logConfigChange(userId, workspaceId, {
      entity: "workspace",
      op: "import",
      resources: parsed.resources.length,
    });
    revalidatePath("/dashboard", "layout");
  });
}
