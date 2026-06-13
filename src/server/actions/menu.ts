"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  logConfigChange,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/guard";
import { Prisma } from "@prisma/client";

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
    const session = await requireRole("ADMIN");
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
      await prisma.menuItem.update({ where: { id: data.id }, data: payload });
    } else {
      const last = await prisma.menuItem.aggregate({
        where: { parentId: data.parentId ?? null },
        _max: { order: true },
      });
      await prisma.menuItem.create({
        data: { ...payload, order: (last._max.order ?? -1) + 1 },
      });
    }

    await logConfigChange(session.user.id, {
      entity: "menu",
      label: data.label,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard", "layout");
  });
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("ADMIN");
    const deleted = await prisma.menuItem.delete({ where: { id } });
    await logConfigChange(session.user.id, {
      entity: "menu",
      label: deleted.label,
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
    await requireRole("ADMIN");
    await prisma.$transaction(
      groups.flatMap((group) =>
        group.orderedIds.map((id, index) =>
          prisma.menuItem.update({
            where: { id },
            data: { order: index, parentId: group.parentId },
          }),
        ),
      ),
    );
    revalidatePath("/dashboard", "layout");
  });
}
