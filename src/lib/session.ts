import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
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
  return {
    userId: session.user.id,
    workspaceId: session.user.activeWorkspaceId,
    role: session.user.role,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}
