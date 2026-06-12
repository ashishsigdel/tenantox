/**
 * Data-plane gateway. All external API calls go through here so that:
 *  - connection secrets never reach the browser
 *  - the dashboard user's role is enforced per resource operation
 *  - create/update/delete actions are recorded in the activity log
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import { toResourceDef } from "@/lib/resources";
import type { ApiResponse, DataRecord } from "@/types/api";
import type { AuthConfig, CrudOperation } from "@/types/meta";
import type { ApiConnection, Prisma, Role } from "@prisma/client";

const requestSchema = z.object({
  resourceSlug: z.string().min(1),
  operation: z.enum(["list", "getOne", "create", "update", "delete"]),
  id: z.union([z.string(), z.number()]).optional(),
  query: z
    .object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(10),
      sort: z.string().optional(),
      search: z.string().optional(),
      filters: z
        .record(
          z.string(),
          z.union([z.string(), z.record(z.string(), z.string())]),
        )
        .optional(),
    })
    .optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const OPERATION_TO_PERMISSION: Record<
  CrudOperation,
  "view" | "create" | "update" | "delete"
> = {
  list: "view",
  getOne: "view",
  create: "create",
  update: "update",
  delete: "delete",
};

function envelopeError(
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string>,
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(fields && { fields }) } },
    { status },
  );
}

function buildAuthHeaders(connection: ApiConnection): Record<string, string> {
  if (connection.authType === "NONE" || !connection.authConfig) return {};
  const config = JSON.parse(decrypt(connection.authConfig)) as AuthConfig;
  switch (config.type) {
    case "BEARER_TOKEN":
      return { Authorization: `Bearer ${config.token}` };
    case "API_KEY_HEADER":
      return { [config.headerName]: config.key };
    case "BASIC":
      return {
        Authorization: `Basic ${Buffer.from(
          `${config.username}:${config.password}`,
        ).toString("base64")}`,
      };
    default:
      return {};
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return envelopeError("UNAUTHORIZED", "Not authenticated", 401);
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return envelopeError("VALIDATION_ERROR", "Invalid proxy request", 422);
  }
  const { resourceSlug, operation, id, query, payload } = parsed.data;

  const row = await prisma.resource.findUnique({
    where: { slug: resourceSlug },
    include: { fields: true, apiConnection: true },
  });
  if (!row) {
    return envelopeError("NOT_FOUND", `Unknown resource: ${resourceSlug}`, 404);
  }
  const resource = toResourceDef(row);

  const permission = OPERATION_TO_PERMISSION[operation];
  const capabilityKey = permission as keyof typeof resource.capabilities;
  if (!resource.capabilities[capabilityKey]) {
    return envelopeError(
      "FORBIDDEN",
      `Operation "${operation}" is disabled for this resource`,
      403,
    );
  }
  const minRole: Role = resource.permissions[permission] ?? "SUPER_ADMIN";
  if (!hasRole(session.user.role, minRole)) {
    return envelopeError(
      "FORBIDDEN",
      `Requires ${minRole} role or higher`,
      403,
    );
  }

  const endpoint = resource.endpoints[operation];
  if (!endpoint) {
    return envelopeError(
      "VALIDATION_ERROR",
      `No endpoint configured for "${operation}"`,
      422,
    );
  }
  if ((operation === "getOne" || operation === "update" || operation === "delete") && id == null) {
    return envelopeError("VALIDATION_ERROR", "Missing record id", 422);
  }

  const base = row.apiConnection.baseUrl.replace(/\/$/, "");
  const path = endpoint.path.replace("{id}", encodeURIComponent(String(id ?? "")));
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);

  if (operation === "list" && query) {
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("pageSize", String(query.pageSize));
    if (query.sort) url.searchParams.set("sort", query.sort);
    if (query.search) url.searchParams.set("search", query.search);
    for (const [field, value] of Object.entries(query.filters ?? {})) {
      if (typeof value === "string") {
        if (value !== "") url.searchParams.set(`filter[${field}]`, value);
      } else {
        for (const [op, v] of Object.entries(value)) {
          if (v !== "") url.searchParams.set(`filter[${field}][${op}]`, v);
        }
      }
    }
  }

  const defaultHeaders =
    (row.apiConnection.defaultHeaders as Record<string, string> | null) ?? {};

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: endpoint.method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...defaultHeaders,
        ...buildAuthHeaders(row.apiConnection),
      },
      body:
        operation === "create" || operation === "update"
          ? JSON.stringify(payload ?? {})
          : undefined,
      cache: "no-store",
    });
  } catch {
    return envelopeError(
      "INTERNAL_ERROR",
      `Could not reach the external API at ${url.origin}`,
      502,
    );
  }

  let body: ApiResponse<DataRecord> | null = null;
  try {
    body = (await upstream.json()) as ApiResponse<DataRecord>;
  } catch {
    return envelopeError(
      "INTERNAL_ERROR",
      `External API returned a non-JSON response (HTTP ${upstream.status}). It must follow the response envelope — see /docs.`,
      502,
    );
  }

  if (
    body &&
    body.success === true &&
    (operation === "create" || operation === "update" || operation === "delete")
  ) {
    const action =
      operation === "create" ? "CREATE" : operation === "update" ? "UPDATE" : "DELETE";
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action,
        resourceSlug,
        recordId: String(
          id ??
            (body.data as DataRecord | null)?.[resource.primaryKeyField] ??
            "",
        ),
        detail: (payload as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  return NextResponse.json(body, { status: upstream.status });
}
