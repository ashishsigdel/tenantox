import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export interface WorkspaceContext {
  userId: string;
  workspaceId: string;
  role: Role;
  email: string;
  name: string;
}

/**
 * Server-component helper: the signed-in user's active workspace context.
 * Redirects to /login when unauthenticated and to /onboarding when the user
 * belongs to no workspace. Use this in every dashboard loader so pages never
 * read the raw session or forget the tenant scope.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.activeWorkspaceId || !session.user.role) {
    redirect("/onboarding");
  }

  // The JWT can outlive the data it references — e.g. the account was deleted
  // or the database was reset while a session cookie was still live. Verify the
  // user still exists and is active; otherwise the session is stale. Send them
  // through /logout (not /login) to actually clear the cookie — redirecting to
  // /login would loop, since the proxy still sees the live cookie and bounces
  // /login → /dashboard → here again.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!user || !user.isActive) redirect("/logout");

  return {
    userId: session.user.id,
    workspaceId: session.user.activeWorkspaceId,
    role: session.user.role,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}
