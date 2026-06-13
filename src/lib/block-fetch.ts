import "server-only";

import { buildAuthHeaders } from "@/lib/api-connection";
import type { ApiConnection } from "@prisma/client";

export interface RawSource {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  rootPath?: string;
  query?: Record<string, string>;
}

/** Replaces `{{var}}` tokens from the supplied runtime variables. */
function interpolate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : "",
  );
}

/**
 * Performs a block's raw upstream request server-side. The connection and
 * path come from stored config — never from the browser — so this cannot be
 * pointed at arbitrary hosts by a client.
 */
export async function fetchRawSource(
  connection: ApiConnection,
  source: RawSource,
  vars: Record<string, string> = {},
  payload?: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
  const base = connection.baseUrl.replace(/\/$/, "");
  const path = interpolate(source.path, vars);
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(source.query ?? {})) {
    url.searchParams.set(key, interpolate(value, vars));
  }

  const defaultHeaders =
    (connection.defaultHeaders as Record<string, string> | null) ?? {};
  const hasBody = source.method !== "GET" && source.method !== "DELETE";

  const upstream = await fetch(url, {
    method: source.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...defaultHeaders,
      ...buildAuthHeaders(connection),
    },
    body: hasBody ? JSON.stringify(payload ?? {}) : undefined,
    cache: "no-store",
  });

  const json = (await upstream.json().catch(() => null)) as unknown;
  return { status: upstream.status, json };
}
