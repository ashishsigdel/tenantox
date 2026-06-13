/**
 * Builder-only preview gateway. Lets an admin test a raw data-source binding
 * before the block is saved. Admin-gated because the caller supplies the
 * connection + path directly.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { fetchRawSource } from "@/lib/block-fetch";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";

const bodySchema = z.object({
  connectionId: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1),
  query: z.record(z.string(), z.string()).optional(),
  vars: z.record(z.string(), z.string()).optional(),
});

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, "ADMIN")) {
    return fail("Admin access required", 403);
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request", 422);
  const { connectionId, method, path, query, vars } = parsed.data;

  const connection = await prisma.apiConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) return fail("Connection not found", 404);

  try {
    const { status, json } = await fetchRawSource(
      connection,
      { method, path, query },
      vars,
    );
    return NextResponse.json({ success: true, status, data: json });
  } catch {
    return fail("Could not reach the external API", 502);
  }
}
