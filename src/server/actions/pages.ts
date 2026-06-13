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
    const session = await requireRole("ADMIN");
    const data = pageSchema.parse(input);

    const existing = await prisma.page.findUnique({ where: { slug: data.slug } });
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

    const saved = data.id
      ? await prisma.page.update({ where: { id: data.id }, data: payload })
      : await prisma.page.create({ data: payload });

    await logConfigChange(session.user.id, {
      entity: "page",
      name: saved.name,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard/settings/pages");
    revalidatePath("/dashboard", "layout");
    return { id: saved.id };
  });
}

export async function deletePage(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("ADMIN");
    const deleted = await prisma.page.delete({ where: { id } });
    await logConfigChange(session.user.id, {
      entity: "page",
      name: deleted.name,
      op: "delete",
    });
    revalidatePath("/dashboard/settings/pages");
    revalidatePath("/dashboard", "layout");
  });
}

const httpMethod = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

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
]);

const blockSchema = z.object({
  id: z.string().optional(),
  pageId: z.string().min(1),
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
  width: z.enum(["full", "half", "third"]),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
  dataSource: dataSourceSchema.nullable().optional(),
  visibleToRoles: z.array(ROLE).nullable().optional(),
});

export type BlockInput = z.infer<typeof blockSchema>;

export async function saveBlock(input: BlockInput): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("ADMIN");
    const data = blockSchema.parse(input);

    const payload = {
      type: data.type,
      width: data.width,
      config: (data.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      dataSource: (data.dataSource ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      visibleToRoles: (data.visibleToRoles ??
        Prisma.JsonNull) as Prisma.InputJsonValue,
    };

    if (data.id) {
      await prisma.block.update({ where: { id: data.id }, data: payload });
    } else {
      const last = await prisma.block.aggregate({
        where: { pageId: data.pageId },
        _max: { order: true },
      });
      await prisma.block.create({
        data: {
          ...payload,
          pageId: data.pageId,
          order: (last._max.order ?? -1) + 1,
        },
      });
    }

    await logConfigChange(session.user.id, {
      entity: "block",
      type: data.type,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard/settings/pages");
    revalidatePath("/dashboard/p", "layout");
  });
}

export async function deleteBlock(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("ADMIN");
    const deleted = await prisma.block.delete({ where: { id } });
    await logConfigChange(session.user.id, {
      entity: "block",
      type: deleted.type,
      op: "delete",
    });
    revalidatePath("/dashboard/settings/pages");
    revalidatePath("/dashboard/p", "layout");
  });
}

/** Persists a new drag-and-drop ordering for a page's blocks. */
export async function reorderBlocks(
  pageId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  return runAction(async () => {
    await requireRole("ADMIN");
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.block.update({
          where: { id, pageId },
          data: { order: index },
        }),
      ),
    );
    revalidatePath("/dashboard/settings/pages");
    revalidatePath("/dashboard/p", "layout");
  });
}
