import { prisma } from "@/lib/prisma";
import type {
  FieldDef,
  ResourceCapabilities,
  ResourceDef,
  ResourceEndpoints,
  ResourcePermissions,
} from "@/types/meta";
import type { FieldDefinition, Resource } from "@prisma/client";

/** Narrows a FieldDefinition row's Json columns to their real types. */
export function toFieldDef(row: FieldDefinition): FieldDef {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    order: row.order,
    config: (row.config as FieldDef["config"]) ?? null,
    validation: (row.validation as FieldDef["validation"]) ?? null,
    showInForm: row.showInForm,
    placeholder: row.placeholder,
    helpText: row.helpText,
    defaultValue: row.defaultValue,
    readOnly: row.readOnly,
    width: row.width as FieldDef["width"],
    visibleIf: (row.visibleIf as FieldDef["visibleIf"]) ?? null,
    showInTable: row.showInTable,
    sortable: row.sortable,
    filterable: row.filterable,
    tableOrder: row.tableOrder,
    format: row.format as FieldDef["format"],
    badgeColorMap:
      (row.badgeColorMap as FieldDef["badgeColorMap"]) ?? null,
  };
}

export function toResourceDef(
  row: Resource & { fields: FieldDefinition[] },
): ResourceDef {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    apiConnectionId: row.apiConnectionId,
    endpoints: row.endpoints as unknown as ResourceEndpoints,
    primaryKeyField: row.primaryKeyField,
    titleField: row.titleField,
    capabilities: row.capabilities as unknown as ResourceCapabilities,
    permissions: row.permissions as unknown as ResourcePermissions,
    fields: row.fields
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toFieldDef),
  };
}

export async function getResourceDef(
  slug: string,
): Promise<ResourceDef | null> {
  const row = await prisma.resource.findUnique({
    where: { slug },
    include: { fields: true },
  });
  return row ? toResourceDef(row) : null;
}
