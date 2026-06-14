"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  logConfigChange,
  requireWorkspaceRole,
  runAction,
  type ActionResult,
} from "@/server/guard";

const connectionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  baseUrl: z.string().regex(/^https?:\/\/.+/, "Must be a valid http(s) URL"),
  authType: z.enum(["NONE", "BEARER_TOKEN", "API_KEY_HEADER", "BASIC"]),
  // Plaintext secret fields from the form; encrypted before storage.
  token: z.string().optional(),
  headerName: z.string().optional(),
  apiKey: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

export type ConnectionInput = z.infer<typeof connectionSchema>;

function buildAuthConfig(input: ConnectionInput): string | null | undefined {
  switch (input.authType) {
    case "NONE":
      return null;
    case "BEARER_TOKEN":
      // Empty secret on edit = keep the existing one.
      if (!input.token) return undefined;
      return encrypt(JSON.stringify({ type: "BEARER_TOKEN", token: input.token }));
    case "API_KEY_HEADER":
      if (!input.apiKey && !input.headerName) return undefined;
      return encrypt(
        JSON.stringify({
          type: "API_KEY_HEADER",
          headerName: input.headerName || "x-api-key",
          key: input.apiKey ?? "",
        }),
      );
    case "BASIC":
      if (!input.username && !input.password) return undefined;
      return encrypt(
        JSON.stringify({
          type: "BASIC",
          username: input.username ?? "",
          password: input.password ?? "",
        }),
      );
  }
}

export async function saveConnection(
  input: ConnectionInput,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("ADMIN");
    const data = connectionSchema.parse(input);
    const authConfig = buildAuthConfig(data);

    const base = {
      name: data.name,
      baseUrl: data.baseUrl.replace(/\/$/, ""),
      authType: data.authType,
      ...(authConfig !== undefined && { authConfig }),
    };

    let savedId: string;
    if (data.id) {
      // Ownership-scoped update: only rows in this workspace are touched.
      const result = await prisma.apiConnection.updateMany({
        where: { id: data.id, workspaceId },
        data: base,
      });
      if (result.count === 0) throw new Error("Connection not found");
      savedId = data.id;
    } else {
      const created = await prisma.apiConnection.create({
        data: { ...base, authConfig: authConfig ?? null, workspaceId },
      });
      savedId = created.id;
    }

    await logConfigChange(userId, workspaceId, {
      entity: "connection",
      name: data.name,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard/settings/connections");
    return { id: savedId };
  });
}

export async function deleteConnection(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("ADMIN");
    const inUse = await prisma.resource.count({
      where: { apiConnectionId: id, workspaceId },
    });
    if (inUse > 0) {
      throw new Error(`Connection is used by ${inUse} resource(s)`);
    }
    const existing = await prisma.apiConnection.findFirst({
      where: { id, workspaceId },
      select: { name: true },
    });
    if (!existing) throw new Error("Connection not found");
    await prisma.apiConnection.deleteMany({ where: { id, workspaceId } });
    await logConfigChange(userId, workspaceId, {
      entity: "connection",
      name: existing.name,
      op: "delete",
    });
    revalidatePath("/dashboard/settings/connections");
  });
}

export type TestConnectionResult = {
  ok: boolean;
  message: string;
  status?: number;
  body?: unknown;
};

function buildTestAuthHeaders(input: {
  authType: string;
  token?: string;
  headerName?: string;
  apiKey?: string;
  username?: string;
  password?: string;
}): Record<string, string> {
  switch (input.authType) {
    case "BEARER_TOKEN":
      return input.token ? { Authorization: `Bearer ${input.token}` } : {};
    case "API_KEY_HEADER":
      return input.headerName && input.apiKey
        ? { [input.headerName]: input.apiKey }
        : {};
    case "BASIC":
      return input.username
        ? {
            Authorization: `Basic ${Buffer.from(
              `${input.username}:${input.password ?? ""}`,
            ).toString("base64")}`,
          }
        : {};
    default:
      return {};
  }
}

/**
 * Pings a list-style endpoint on the connection and verifies the response
 * follows the API contract envelope.
 */
export async function testConnection(input: {
  baseUrl: string;
  testPath: string;
  authType?: string;
  token?: string;
  headerName?: string;
  apiKey?: string;
  username?: string;
  password?: string;
}): Promise<TestConnectionResult> {
  try {
    await requireWorkspaceRole("ADMIN");
    const authHeaders = buildTestAuthHeaders({ ...input, authType: input.authType ?? "NONE" });
    const url = `${input.baseUrl.replace(/\/$/, "")}${input.testPath.startsWith("/") ? input.testPath : `/${input.testPath}`}`;
    const res = await fetch(`${url}?page=1&pageSize=1`, {
      headers: { Accept: "application/json", ...authHeaders },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json();
    if (typeof body.success !== "boolean") {
      return {
        ok: false,
        message:
          "Endpoint responded, but without the { success, data } envelope required by the contract.",
        status: res.status,
        body,
      };
    }
    if (body.success && !Array.isArray(body.data)) {
      return {
        ok: false,
        message: "Envelope OK, but `data` is not an array for a list endpoint.",
        status: res.status,
        body,
      };
    }
    return {
      ok: true,
      message: `Contract OK (HTTP ${res.status}${body.meta ? `, total: ${body.meta.total}` : ""})`,
      status: res.status,
      body,
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error && e.name === "TimeoutError"
          ? "Timed out after 8s"
          : "Could not reach the endpoint or response was not JSON.",
    };
  }
}

export interface ConnectionRow {
  id: string;
  name: string;
  baseUrl: string;
  authType: "NONE" | "BEARER_TOKEN" | "API_KEY_HEADER" | "BASIC";
  resourceCount: number;
}

/** Returns all API connections for the active workspace (modal data fetch). */
export async function listConnections(): Promise<ConnectionRow[]> {
  const { workspaceId } = await requireWorkspaceRole("ADMIN");
  const rows = await prisma.apiConnection.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { resources: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    authType: row.authType,
    resourceCount: row._count.resources,
  }));
}
