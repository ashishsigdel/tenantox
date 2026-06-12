import { ZodError } from "zod";
import { auth } from "@/auth";
import { hasRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

export class ForbiddenError extends Error {}

/** Returns the session if the user holds at least `minimum`, else throws. */
export async function requireRole(minimum: Role) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, minimum)) {
    throw new ForbiddenError("You don't have permission to do this.");
  }
  return session;
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
  detail: Prisma.InputJsonValue,
) {
  await prisma.activityLog.create({
    data: { userId, action: "CONFIG_CHANGE", detail },
  });
}
