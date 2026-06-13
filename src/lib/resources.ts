import { prisma } from "@/lib/prisma";
import { DEFAULT_API_MAPPING } from "@/types/meta";
import type {
  ApiMapping,
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
  const capabilities = row.capabilities as unknown as ResourceCapabilities;
  const rawEndpoints = row.endpoints as unknown as ResourceEndpoints;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    apiConnectionId: row.apiConnectionId,
    endpoints: withEnabledDefaults(rawEndpoints, capabilities),
    primaryKeyField: row.primaryKeyField,
    titleField: row.titleField,
    capabilities,
    permissions: row.permissions as unknown as ResourcePermissions,
    apiMapping: withApiMappingDefaults(row.apiMapping),
    fields: row.fields
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toFieldDef),
  };
}

/** Merges a stored apiMapping over the defaults (older rows have null). */
function withApiMappingDefaults(stored: unknown): ApiMapping {
  const m = (stored as Partial<ApiMapping> | null) ?? {};
  return {
    request: { ...DEFAULT_API_MAPPING.request, ...(m.request ?? {}) },
    response: { ...DEFAULT_API_MAPPING.response, ...(m.response ?? {}) },
  };
}

/**
 * Back-compat: rows saved before per-endpoint `enabled` existed derive it from
 * the old capability flags (list/getOne ← view; create/update/delete 1:1).
 */
function withEnabledDefaults(
  endpoints: ResourceEndpoints,
  capabilities: ResourceCapabilities,
): ResourceEndpoints {
  const fallback: Record<keyof ResourceEndpoints, boolean> = {
    list: capabilities?.view ?? true,
    getOne: capabilities?.view ?? true,
    create: capabilities?.create ?? true,
    update: capabilities?.update ?? true,
    delete: capabilities?.delete ?? true,
  };
  const result = {} as ResourceEndpoints;
  for (const op of Object.keys(endpoints) as (keyof ResourceEndpoints)[]) {
    const ep = endpoints[op];
    result[op] = { ...ep, enabled: ep.enabled ?? fallback[op] };
  }
  return result;
}

export async function getResourceDef(
  workspaceId: string,
  slug: string,
): Promise<ResourceDef | null> {
  const row = await prisma.resource.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } },
    include: { fields: true },
  });
  return row ? toResourceDef(row) : null;
}
