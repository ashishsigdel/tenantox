import { ZodError } from "zod";
import { auth } from "@/auth";
import { hasRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

export class ForbiddenError extends Error {}

export interface ActionContext {
  userId: string;
  workspaceId: string;
  role: Role;
}

/**
 * Resolves the caller's active workspace and verifies they hold at least
 * `minimum` within it. Membership is re-read from the DB here — the JWT role is
 * never trusted for authorization. Throws ForbiddenError otherwise.
 */
export async function requireWorkspaceRole(
  minimum: Role,
): Promise<ActionContext> {
  const session = await auth();
  const workspaceId = session?.user?.activeWorkspaceId;
  if (!session?.user || !workspaceId) {
    throw new ForbiddenError("You don't have permission to do this.");
  }
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId: session.user.id, workspaceId },
    },
  });
  if (!membership || !hasRole(membership.role, minimum)) {
    throw new ForbiddenError("You don't have permission to do this.");
  }
  return { userId: session.user.id, workspaceId, role: membership.role };
}

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fields?: Record<string, string> };

/** Wraps an action body, mapping thrown errors into an ActionResult. */
export async function runAction(
  fn: () => Promise<{ id?: string } | void>,
): Promise<ActionResult> {
  try {
    const result = await fn();
    return { ok: true, id: result?.id };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return {
        ok: false,
        error: e.issues[0]?.message ?? "Invalid input",
      };
    }
    if (e instanceof Error && e.message) {
      return { ok: false, error: e.message };
    }
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function logConfigChange(
  userId: string,
  workspaceId: string,
  detail: Prisma.InputJsonValue,
) {
  await prisma.activityLog.create({
    data: { userId, workspaceId, action: "CONFIG_CHANGE", detail },
  });
}
