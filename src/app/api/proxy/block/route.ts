/**
 * Block data gateway. A block fetches its data by id only — the connection,
 * method, and path come from the stored block.dataSource, so the browser can
 * never aim the request at an arbitrary host. Per-block / per-page role rules
 * are enforced here before any upstream call.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { fetchRawSource, type RawSource } from "@/lib/block-fetch";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import type { BlockDataSource } from "@/types/meta";
import type { Role } from "@prisma/client";

const bodySchema = z.object({
  blockId: z.string().min(1),
  vars: z.record(z.string(), z.string()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return fail("Not authenticated", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request", 422);
  const { blockId, vars, payload } = parsed.data;

  const block = await prisma.block.findUnique({
    where: { id: blockId },
    include: { page: true },
  });
  if (!block) return fail("Unknown block", 404);

  const allowed = (block.visibleToRoles as Role[] | null) ?? null;
  const meetsBlock = allowed
    ? allowed.includes(session.user.role)
    : hasRole(session.user.role, block.page.viewRole);
  if (!meetsBlock) return fail("You don't have access to this block", 403);

  const source = block.dataSource as BlockDataSource | null;
  if (!source || source.mode !== "raw") {
    return fail("This block has no raw data source", 422);
  }

  const connection = await prisma.apiConnection.findUnique({
    where: { id: source.connectionId },
  });
  if (!connection) return fail("Connection not found", 404);

  try {
    const { status, json } = await fetchRawSource(
      connection,
      source as RawSource & { connectionId: string },
      vars,
      payload,
    );
    return NextResponse.json({ success: true, status, data: json });
  } catch {
    return fail("Could not reach the external API", 502);
  }
}
