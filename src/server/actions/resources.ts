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
const endpointSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1),
  enabled: z.boolean().optional(),
  dataPath: z.string().optional(),
});

const resourceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, dashes"),
  icon: z.string().optional(),
  apiConnectionId: z.string().min(1, "Pick a connection"),
  endpoints: z.object({
    list: endpointSchema,
    getOne: endpointSchema,
    create: endpointSchema,
    update: endpointSchema,
    delete: endpointSchema,
  }),
  primaryKeyField: z.string().min(1),
  titleField: z.string().min(1),
  capabilities: z.object({
    view: z.boolean(),
    create: z.boolean(),
    update: z.boolean(),
    delete: z.boolean(),
  }),
  permissions: z.object({
    view: ROLE,
    create: ROLE,
    update: ROLE,
    delete: ROLE,
  }),
  apiMapping: z
    .object({
      request: z.object({
        pageParam: z.string().default("page"),
        pageSizeParam: z.string().default("pageSize"),
        sortParam: z.string().default("sort"),
        searchParam: z.string().default("search"),
        filterStyle: z.enum(["bracket", "flat"]).default("bracket"),
      }),
      response: z.object({
        dataPath: z.string().default("data"),
        totalPath: z.string().default("meta.total"),
        successPath: z.string().optional(),
        errorPath: z.string().optional(),
      }),
    })
    .optional(),
});

export type ResourceInput = z.infer<typeof resourceSchema>;

export async function saveResource(input: ResourceInput): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("ADMIN");
    const data = resourceSchema.parse(input);

    const existing = await prisma.resource.findUnique({
      where: { slug: data.slug },
    });
    if (existing && existing.id !== data.id) {
      throw new Error(`Slug "${data.slug}" is already in use`);
    }

    const payload = {
      name: data.name,
      slug: data.slug,
      icon: data.icon || null,
      apiConnectionId: data.apiConnectionId,
      endpoints: data.endpoints as unknown as Prisma.InputJsonValue,
      primaryKeyField: data.primaryKeyField,
      titleField: data.titleField,
      capabilities: data.capabilities as unknown as Prisma.InputJsonValue,
      permissions: data.permissions as unknown as Prisma.InputJsonValue,
      apiMapping: (data.apiMapping ??
        Prisma.JsonNull) as Prisma.InputJsonValue,
    };

    const saved = data.id
      ? await prisma.resource.update({ where: { id: data.id }, data: payload })
      : await prisma.resource.create({ data: payload });

    await logConfigChange(session.user.id, {
      entity: "resource",
      name: saved.name,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard/settings/resources");
    revalidatePath("/dashboard", "layout");
    return { id: saved.id };
  });
}

export async function deleteResource(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("ADMIN");
    const deleted = await prisma.resource.delete({ where: { id } });
    await logConfigChange(session.user.id, {
      entity: "resource",
      name: deleted.name,
      op: "delete",
    });
    revalidatePath("/dashboard/settings/resources");
    revalidatePath("/dashboard", "layout");
  });
}

const fieldSchema = z.object({
  id: z.string().optional(),
  resourceId: z.string().min(1),
  key: z
    .string()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Must be a valid JSON property name"),
  label: z.string().min(1, "Label is required"),
  type: z.enum([
    "TEXT", "TEXTAREA", "RICH_TEXT", "NUMBER", "BOOLEAN", "DATE", "DATETIME",
    "SELECT", "MULTI_SELECT", "RADIO", "EMAIL", "URL", "PASSWORD", "FILE",
    "IMAGE", "JSON", "RELATION", "COLOR", "SLUG",
  ]),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
  validation: z.record(z.string(), z.unknown()).nullable().optional(),
  showInForm: z.boolean(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: z.string().optional(),
  readOnly: z.boolean(),
  width: z.enum(["full", "half", "third"]),
  visibleIf: z.record(z.string(), z.unknown()).nullable().optional(),
  showInTable: z.boolean(),
  sortable: z.boolean(),
  filterable: z.boolean(),
  format: z.enum([
    "text", "badge", "date", "datetime", "currency", "boolean-icon",
    "image-thumb", "truncate", "link",
  ]),
  badgeColorMap: z.record(z.string(), z.string()).nullable().optional(),
});

export type FieldInput = z.infer<typeof fieldSchema>;

export async function saveField(input: FieldInput): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("ADMIN");
    const data = fieldSchema.parse(input);

    const duplicate = await prisma.fieldDefinition.findUnique({
      where: { resourceId_key: { resourceId: data.resourceId, key: data.key } },
    });
    if (duplicate && duplicate.id !== data.id) {
      throw new Error(`A field with key "${data.key}" already exists`);
    }

    const payload = {
      key: data.key,
      label: data.label,
      type: data.type,
      config: (data.config ?? undefined) as Prisma.InputJsonValue | undefined,
      validation: (data.validation ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      showInForm: data.showInForm,
      placeholder: data.placeholder || null,
      helpText: data.helpText || null,
      defaultValue: data.defaultValue || null,
      readOnly: data.readOnly,
      width: data.width,
      visibleIf: (data.visibleIf ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      showInTable: data.showInTable,
      sortable: data.sortable,
      filterable: data.filterable,
      format: data.format,
      badgeColorMap: (data.badgeColorMap ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    };

    if (data.id) {
      // Explicitly clear JSON columns that were set to null.
      await prisma.fieldDefinition.update({
        where: { id: data.id },
        data: {
          ...payload,
          config: (data.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          validation: (data.validation ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          visibleIf: (data.visibleIf ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          badgeColorMap: (data.badgeColorMap ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } else {
      const last = await prisma.fieldDefinition.aggregate({
        where: { resourceId: data.resourceId },
        _max: { order: true, tableOrder: true },
      });
      await prisma.fieldDefinition.create({
        data: {
          ...payload,
          resourceId: data.resourceId,
          order: (last._max.order ?? -1) + 1,
          tableOrder: (last._max.tableOrder ?? -1) + 1,
        },
      });
    }

    await logConfigChange(session.user.id, {
      entity: "field",
      key: data.key,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard/settings/resources");
  });
}

export async function deleteField(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("ADMIN");
    const deleted = await prisma.fieldDefinition.delete({ where: { id } });
    await logConfigChange(session.user.id, {
      entity: "field",
      key: deleted.key,
      op: "delete",
    });
    revalidatePath("/dashboard/settings/resources");
  });
}

/** Persists a new drag-and-drop ordering. `kind` picks form vs table order. */
export async function reorderFields(
  resourceId: string,
  orderedIds: string[],
  kind: "form" | "table",
): Promise<ActionResult> {
  return runAction(async () => {
    await requireRole("ADMIN");
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.fieldDefinition.update({
          where: { id, resourceId },
          data: kind === "form" ? { order: index } : { tableOrder: index },
        }),
      ),
    );
    revalidatePath("/dashboard/settings/resources");
  });
}
