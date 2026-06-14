"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { emptyLayout, type PageLayout } from "@/types/meta";
import {
  logConfigChange,
  requireWorkspaceRole,
  runAction,
  type ActionResult,
} from "@/server/guard";
import { Prisma, type Role } from "@prisma/client";
import { toPageLayout } from "@/lib/pages";

/** Throws unless the page exists in the given workspace. */
async function assertPageInWorkspace(pageId: string, workspaceId: string) {
  const owned = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
    select: { id: true },
  });
  if (!owned) throw new Error("Page not found");
}

const ROLE = z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "VIEWER"]);

const pageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, dashes"),
  icon: z.string().optional(),
  description: z.string().optional(),
  viewRole: ROLE,
});

export type PageInput = z.infer<typeof pageSchema>;

export async function savePage(input: PageInput): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("ADMIN");
    const data = pageSchema.parse(input);

    const existing = await prisma.page.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: data.slug } },
    });
    if (existing && existing.id !== data.id) {
      throw new Error(`Slug "${data.slug}" is already in use`);
    }

    const payload = {
      name: data.name,
      slug: data.slug,
      icon: data.icon || null,
      description: data.description || null,
      viewRole: data.viewRole,
    };

    let savedId: string;
    if (data.id) {
      const result = await prisma.page.updateMany({
        where: { id: data.id, workspaceId },
        data: payload,
      });
      if (result.count === 0) throw new Error("Page not found");
      savedId = data.id;
    } else {
      const created = await prisma.page.create({
        data: {
          ...payload,
          workspaceId,
          layout: emptyLayout(crypto.randomUUID()) as unknown as Prisma.InputJsonValue,
        },
      });
      savedId = created.id;
    }

    await logConfigChange(userId, workspaceId, {
      entity: "page",
      name: data.name,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard/settings/pages");
    revalidatePath("/dashboard", "layout");
    return { id: savedId };
  });
}

export async function deletePage(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("ADMIN");
    const existing = await prisma.page.findFirst({
      where: { id, workspaceId },
      select: { name: true },
    });
    if (!existing) throw new Error("Page not found");
    await prisma.page.deleteMany({ where: { id, workspaceId } });
    await logConfigChange(userId, workspaceId, {
      entity: "page",
      name: existing.name,
      op: "delete",
    });
    revalidatePath("/dashboard/settings/pages");
    revalidatePath("/dashboard", "layout");
  });
}

const httpMethod = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const width = z.enum(["full", "half", "third"]);

const dataSourceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("resource"), resourceId: z.string().min(1) }),
  z.object({
    mode: z.literal("raw"),
    connectionId: z.string().min(1),
    method: httpMethod,
    path: z.string().min(1),
    rootPath: z.string().optional(),
    query: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    mode: z.literal("group"),
    rootPath: z.string().optional(),
  }),
]);

const blockNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("block").optional(),
  type: z.enum([
    "TABLE",
    "CHART",
    "STAT",
    "BUTTON",
    "HEADING",
    "TEXT",
    "DIVIDER",
    "CALLOUT",
  ]),
  width,
  config: z.record(z.string(), z.unknown()).nullable(),
  dataSource: dataSourceSchema.nullable(),
  visibleToRoles: z.array(ROLE).nullable(),
});

const groupSourceSchema = z.object({
  connectionId: z.string().min(1),
  method: httpMethod,
  path: z.string().min(1),
  query: z.record(z.string(), z.string()).optional(),
});

const groupNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("group"),
  width,
  config: z.object({
    title: z.string().optional(),
    columns: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)])
      .optional(),
  }),
  source: groupSourceSchema.nullable(),
  children: z.array(blockNodeSchema),
  visibleToRoles: z.array(ROLE).nullable(),
});

const layoutNodeSchema = z.union([groupNodeSchema, blockNodeSchema]);

const sectionSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("section"),
  children: z.array(layoutNodeSchema),
});

const layoutSchema = z.object({
  version: z.literal(1),
  root: sectionSchema,
});

export type LayoutInput = z.infer<typeof layoutSchema>;

/**
 * Persists a page's whole layout tree in one shot. The builder owns the tree
 * client-side and autosaves it; this validates and stores it.
 */
export async function savePageLayout(
  pageId: string,
  layout: PageLayout,
): Promise<ActionResult> {
  return runAction(async () => {
    const { workspaceId } = await requireWorkspaceRole("ADMIN");
    await assertPageInWorkspace(pageId, workspaceId);
    const parsed = layoutSchema.parse(layout);

    await prisma.page.updateMany({
      where: { id: pageId, workspaceId },
      data: { layout: parsed as unknown as Prisma.InputJsonValue },
    });

    revalidatePath("/dashboard/settings/pages");
    revalidatePath("/dashboard/p", "layout");
  });
}

export interface PageRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  viewRole: Role;
  blockCount: number;
}

/** Returns all pages for the active workspace (modal data fetch). */
export async function listPages(): Promise<PageRow[]> {
  const { workspaceId } = await requireWorkspaceRole("ADMIN");
  const rows = await prisma.page.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    viewRole: row.viewRole,
    blockCount: toPageLayout(row.layout).root.children.length,
  }));
}

/** Returns all data needed by the page builder modal section. */
export async function getPageForBuilder(id: string) {
  const { workspaceId } = await requireWorkspaceRole("ADMIN");
  const [row, connections, resources] = await Promise.all([
    prisma.page.findFirst({ where: { id, workspaceId } }),
    prisma.apiConnection.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.resource.findMany({
      where: { workspaceId },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!row) throw new Error("Page not found");

  const { toPageDef } = await import("@/lib/pages");
  const page = toPageDef(row);
  const initial: PageInput = {
    id: page.id,
    name: page.name,
    slug: page.slug,
    icon: page.icon ?? "",
    description: page.description ?? "",
    viewRole: page.viewRole,
  };

  return { page, initial, connections, resources };
}
