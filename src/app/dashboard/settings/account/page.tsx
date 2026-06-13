import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AccountClient } from "./account-client";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const ctx = await getWorkspaceContext();

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true, email: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">
          Your personal profile information.
        </p>
      </div>
      <AccountClient name={user.name} email={user.email} role={ctx.role} />
    </div>
  );
}
