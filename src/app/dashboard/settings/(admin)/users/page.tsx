import { getWorkspaceContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UsersClient } from "./users-client";

export const metadata = { title: "Members" };

export default async function UsersPage() {
  const ctx = await getWorkspaceContext();
  const memberships = await prisma.membership.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          People who can access this workspace and what they&apos;re allowed to
          do.
        </p>
      </div>
      <UsersClient
        members={memberships.map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
        }))}
        currentUserId={ctx.userId}
      />
    </div>
  );
}
