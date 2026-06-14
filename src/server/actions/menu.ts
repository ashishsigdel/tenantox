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
import { Prisma, type MenuItemType, type Role } from "@prisma/client";

const menuItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Label is required"),
  icon: z.string().optional(),
  type: z.enum(["GROUP", "RESOURCE", "PAGE", "LINK", "DIVIDER"]),
  resourceId: z.string().optional(),
  pageId: z.string().optional(),
  href: z.string().optional(),
  parentId: z.string().nullable().optional(),
  visibleToRoles: z
    .array(z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "VIEWER"]))
    .optional(),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;

export async function saveMenuItem(input: MenuItemInput): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("ADMIN");
    const data = menuItemSchema.parse(input);

    if (data.type === "RESOURCE" && !data.resourceId) {
      throw new Error("Pick a resource for this menu item");
    }
    if (data.type === "PAGE" && !data.pageId) {
      throw new Error("Pick a page for this menu item");
    }
    if (data.type === "LINK" && !data.href) {
      throw new Error("Enter a URL for this menu item");
    }

    const payload = {
      label: data.label,
      icon: data.icon || null,
      type: data.type,
      resourceId: data.type === "RESOURCE" ? data.resourceId : null,
      pageId: data.type === "PAGE" ? data.pageId : null,
      href: data.type === "LINK" ? data.href : null,
      parentId: data.parentId ?? null,
      visibleToRoles: (data.visibleToRoles?.length
        ? data.visibleToRoles
        : Prisma.JsonNull) as Prisma.InputJsonValue,
    };

    if (data.id) {
      const result = await prisma.menuItem.updateMany({
        where: { id: data.id, workspaceId },
        data: payload,
      });
      if (result.count === 0) throw new Error("Menu item not found");
    } else {
      const last = await prisma.menuItem.aggregate({
        where: { workspaceId, parentId: data.parentId ?? null },
        _max: { order: true },
      });
      await prisma.menuItem.create({
        data: { ...payload, workspaceId, order: (last._max.order ?? -1) + 1 },
      });
    }

    await logConfigChange(userId, workspaceId, {
      entity: "menu",
      label: data.label,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard", "layout");
  });
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("ADMIN");
    const existing = await prisma.menuItem.findFirst({
      where: { id, workspaceId },
      select: { label: true },
    });
    if (!existing) throw new Error("Menu item not found");
    await prisma.menuItem.deleteMany({ where: { id, workspaceId } });
    await logConfigChange(userId, workspaceId, {
      entity: "menu",
      label: existing.label,
      op: "delete",
    });
    revalidatePath("/dashboard", "layout");
  });
}

/** Persists a drag-and-drop result: ordered ids per parent (null = root). */
export async function reorderMenu(
  groups: { parentId: string | null; orderedIds: string[] }[],
): Promise<ActionResult> {
  return runAction(async () => {
    const { workspaceId } = await requireWorkspaceRole("ADMIN");
    await prisma.$transaction(
      groups.flatMap((group) =>
        group.orderedIds.map((id, index) =>
          prisma.menuItem.updateMany({
            where: { id, workspaceId },
            data: { order: index, parentId: group.parentId },
          }),
        ),
      ),
    );
    revalidatePath("/dashboard", "layout");
  });
}

export interface MenuItemRow {
  id: string;
  label: string;
  icon: string | null;
  type: MenuItemType;
  resourceId: string | null;
  pageId: string | null;
  href: string | null;
  parentId: string | null;
  order: number;
  visibleToRoles: Role[];
}

export interface MenuBuilderData {
  items: MenuItemRow[];
  resources: { id: string; name: string }[];
  pages: { id: string; name: string }[];
}

/** Returns all data needed by the menu builder (modal data fetch). */
export async function getMenuBuilderData(): Promise<MenuBuilderData> {
  const { workspaceId } = await requireWorkspaceRole("ADMIN");
  const [items, resources, pages] = await Promise.all([
    prisma.menuItem.findMany({ where: { workspaceId }, orderBy: { order: "asc" } }),
    prisma.resource.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.page.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    items: items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      type: item.type,
      resourceId: item.resourceId,
      pageId: item.pageId,
      href: item.href,
      parentId: item.parentId,
      order: item.order,
      visibleToRoles: (item.visibleToRoles as Role[] | null) ?? [],
    })),
    resources,
    pages,
  };
}
