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
import { findNode, toPageLayout } from "@/lib/pages";
import { hasRole } from "@/lib/roles";
import { isGroup } from "@/types/meta";
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

  // Load the page (scoped to the caller's workspace).
  const page = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
    select: { layout: true, viewRole: true },
  });
  if (!page) return fail("Unknown page", 404);

  const layout = toPageLayout(page.layout);

  // nodeId may be a leaf block id or a Group container id.
  const node = findNode(layout, nodeId);
  if (!node) return fail("Unknown block", 404);

  // Enforce the node's visibility rules.
  const allowed = node.visibleToRoles;
  const meets =
    allowed && allowed.length > 0
      ? allowed.includes(role)
      : hasRole(role, page.viewRole);
  if (!meets) return fail("You don't have access to this block", 403);

  let connectionId: string;
  let rawSource: RawSource;

  if (isGroup(node)) {
    // Group: one shared upstream call for all its children.
    if (!node.source) return fail("This group has no data source", 422);
    connectionId = node.source.connectionId;
    rawSource = {
      method: node.source.method,
      path: node.source.path,
      query: node.source.query,
    };
  } else {
    const source = node.dataSource as BlockDataSource | null;
    if (!source || source.mode !== "raw") {
      // `group`-mode children read the group's data from context, never here.
      return fail("This block has no raw data source", 422);
    }
    connectionId = source.connectionId;
    rawSource = source as RawSource;
  }

  const connection = await prisma.apiConnection.findFirst({
    where: { id: connectionId, workspaceId },
  });
  if (!connection) return fail("Connection not found", 404);

  try {
    const { status, json } = await fetchRawSource(connection, rawSource, vars, payload);
    return NextResponse.json({ success: true, status, data: json });
  } catch {
    return fail("Could not reach the external API", 502);
  }
}
