"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  logConfigChange,
  requireRole,
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
    const session = await requireRole("ADMIN");
    const data = connectionSchema.parse(input);
    const authConfig = buildAuthConfig(data);

    const base = {
      name: data.name,
      baseUrl: data.baseUrl.replace(/\/$/, ""),
      authType: data.authType,
      ...(authConfig !== undefined && { authConfig }),
    };

    const saved = data.id
      ? await prisma.apiConnection.update({ where: { id: data.id }, data: base })
      : await prisma.apiConnection.create({
          data: { ...base, authConfig: authConfig ?? null },
        });

    await logConfigChange(session.user.id, {
      entity: "connection",
      name: saved.name,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard/settings/connections");
    return { id: saved.id };
  });
}

export async function deleteConnection(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("ADMIN");
    const inUse = await prisma.resource.count({
      where: { apiConnectionId: id },
    });
    if (inUse > 0) {
      throw new Error(`Connection is used by ${inUse} resource(s)`);
    }
    const deleted = await prisma.apiConnection.delete({ where: { id } });
    await logConfigChange(session.user.id, {
      entity: "connection",
      name: deleted.name,
      op: "delete",
    });
    revalidatePath("/dashboard/settings/connections");
  });
}

/**
 * Pings a list-style endpoint on the connection and verifies the response
 * follows the API contract envelope.
 */
export async function testConnection(input: {
  baseUrl: string;
  testPath: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    await requireRole("ADMIN");
    const url = `${input.baseUrl.replace(/\/$/, "")}${input.testPath.startsWith("/") ? input.testPath : `/${input.testPath}`}`;
    const res = await fetch(`${url}?page=1&pageSize=1`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json();
    if (typeof body.success !== "boolean") {
      return {
        ok: false,
        message:
          "Endpoint responded, but without the { success, data } envelope required by the contract.",
      };
    }
    if (body.success && !Array.isArray(body.data)) {
      return {
        ok: false,
        message: "Envelope OK, but `data` is not an array for a list endpoint.",
      };
    }
    return {
      ok: true,
      message: `Contract OK (HTTP ${res.status}${body.meta ? `, total: ${body.meta.total}` : ""})`,
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
