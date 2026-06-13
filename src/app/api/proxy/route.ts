/**
 * Data-plane gateway. All external API calls go through here so that:
 *  - connection secrets never reach the browser
 *  - the dashboard user's role is enforced per resource operation
 *  - create/update/delete actions are recorded in the activity log
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { buildAuthHeaders } from "@/lib/api-connection";
import { getPath } from "@/lib/json-path";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import { toResourceDef } from "@/lib/resources";
import type { ApiErrorCode, ApiResponse, DataRecord, ListMeta } from "@/types/api";
import type { CrudOperation, ResponseMapping } from "@/types/meta";
import type { Prisma, Role } from "@prisma/client";

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
  const endpoint = resource.endpoints[operation];
  if (!endpoint || endpoint.enabled === false) {
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

  if ((operation === "getOne" || operation === "update" || operation === "delete") && id == null) {
    return envelopeError("VALIDATION_ERROR", "Missing record id", 422);
  }
  if ((operation === "getOne" || operation === "update" || operation === "delete") && id == null) {
    return envelopeError("VALIDATION_ERROR", "Missing record id", 422);
  }

  const base = row.apiConnection.baseUrl.replace(/\/$/, "");
  const path = endpoint.path.replace("{id}", encodeURIComponent(String(id ?? "")));
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);

  if (operation === "list" && query) {
    const rq = resource.apiMapping.request;
    const flat = rq.filterStyle === "flat";
    url.searchParams.set(rq.pageParam, String(query.page));
    url.searchParams.set(rq.pageSizeParam, String(query.pageSize));
    if (query.sort) url.searchParams.set(rq.sortParam, query.sort);
    if (query.search) url.searchParams.set(rq.searchParam, query.search);
    for (const [field, value] of Object.entries(query.filters ?? {})) {
      if (typeof value === "string") {
        if (value !== "")
          url.searchParams.set(flat ? field : `filter[${field}]`, value);
      } else {
        for (const [op, v] of Object.entries(value)) {
          if (v === "") continue;
          // Flat style supports equality only; skip operator-qualified filters.
          if (flat) {
            if (op === "eq") url.searchParams.set(field, v);
          } else {
            url.searchParams.set(`filter[${field}][${op}]`, v);
          }
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

  let rawBody: unknown = null;
  try {
    rawBody = await upstream.json();
  } catch {
    // Empty / non-JSON body (e.g. 204 on delete) — fall back to null.
    rawBody = null;
  }

  const body = normalizeResponse(
    rawBody,
    upstream.ok,
    upstream.statusText,
    {
      ...resource.apiMapping.response,
      // Per-endpoint data path wins over the resource-wide default.
      dataPath: endpoint.dataPath ?? resource.apiMapping.response.dataPath,
    },
    query,
  );

  if (
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

  return NextResponse.json(body);
}

/** Adapts an arbitrary upstream response into the standard envelope. */
function normalizeResponse(
  body: unknown,
  httpOk: boolean,
  statusText: string,
  m: ResponseMapping,
  query?: { page: number; pageSize: number },
): ApiResponse<DataRecord> {
  const envelopeSuccess = (body as { success?: unknown } | null)?.success;
  const success = m.successPath
    ? !!getPath(body, m.successPath)
    : typeof envelopeSuccess === "boolean"
      ? envelopeSuccess
      : httpOk;

  if (!success) {
    const rawMsg = m.errorPath
      ? getPath(body, m.errorPath)
      : getPath(body, "error.message");
    const message =
      String(rawMsg ?? "") || statusText || "Request failed";
    const code =
      (getPath(body, "error.code") as ApiErrorCode | undefined) ??
      "INTERNAL_ERROR";
    const fields = getPath(body, "error.fields");
    return {
      success: false,
      error: {
        code,
        message,
        ...(fields && typeof fields === "object"
          ? { fields: fields as Record<string, string> }
          : {}),
      },
    };
  }

  const data = (m.dataPath ? getPath(body, m.dataPath) : body) ?? null;

  const totalRaw = getPath(body, m.totalPath);
  const total =
    typeof totalRaw === "number"
      ? totalRaw
      : typeof totalRaw === "string" && totalRaw.trim() !== "" && !Number.isNaN(Number(totalRaw))
        ? Number(totalRaw)
        : undefined;
  let meta: ListMeta | undefined;
  if (total != null && query) {
    const pageSize = query.pageSize || 10;
    meta = {
      page: query.page || 1,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  return {
    success: true,
    data: data as DataRecord,
    ...(meta && { meta }),
  };
}
