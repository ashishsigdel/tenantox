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
import { findBlock, toPageLayout } from "@/lib/pages";
import { hasRole } from "@/lib/roles";
import type { BlockDataSource } from "@/types/meta";

const bodySchema = z.object({
  pageId: z.string().min(1),
  nodeId: z.string().min(1),
  vars: z.record(z.string(), z.string()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const workspaceId = session?.user?.activeWorkspaceId;
  const role = session?.user?.role;
  if (!session?.user || !workspaceId || !role) {
    return fail("Not authenticated", 401);
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request", 422);
  const { pageId, nodeId, vars, payload } = parsed.data;

  // Load the page (scoped to the caller's workspace) and find the block leaf.
  const page = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
    select: { layout: true, viewRole: true },
  });
  if (!page) return fail("Unknown page", 404);

  const block = findBlock(toPageLayout(page.layout), nodeId);
  if (!block) return fail("Unknown block", 404);

  const allowed = block.visibleToRoles;
  const meetsBlock =
    allowed && allowed.length > 0
      ? allowed.includes(role)
      : hasRole(role, page.viewRole);
  if (!meetsBlock) return fail("You don't have access to this block", 403);

  const source = block.dataSource as BlockDataSource | null;
  if (!source || source.mode !== "raw") {
    return fail("This block has no raw data source", 422);
  }

  const connection = await prisma.apiConnection.findFirst({
    where: { id: source.connectionId, workspaceId },
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
