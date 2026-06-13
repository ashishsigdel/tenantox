import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasRole } from "@/lib/roles";
import { SettingsModal } from "@/components/layout/settings-modal";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = !!session.user.role && hasRole(session.user.role, "ADMIN");

  return <SettingsModal isAdmin={isAdmin}>{children}</SettingsModal>;
}
