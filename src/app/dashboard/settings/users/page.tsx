import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import { UsersClient } from "./users-client";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, "SUPER_ADMIN")) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard Users</h1>
        <p className="text-sm text-muted-foreground">
          People who can sign in to this dashboard and what they&apos;re
          allowed to do.
        </p>
      </div>
      <UsersClient
        users={users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}
