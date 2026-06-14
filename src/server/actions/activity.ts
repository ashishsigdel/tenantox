"use server";

import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/server/guard";

export interface ActivityLogRow {
  id: string;
  createdAt: string;
  userName: string;
  action: string;
  resourceSlug: string | null;
  recordId: string | null;
  detail: unknown;
}

/** Returns the last 200 activity logs for the active workspace. */
export async function listActivityLogs(): Promise<ActivityLogRow[]> {
  const { workspaceId } = await requireWorkspaceRole("ADMIN");
  const logs = await prisma.activityLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true } } },
  });
  return logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userName: log.user.name,
    action: log.action,
    resourceSlug: log.resourceSlug,
    recordId: log.recordId,
    detail: log.detail,
  }));
}
