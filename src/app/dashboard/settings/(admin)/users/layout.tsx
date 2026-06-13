import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasRole } from "@/lib/roles";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || !session.user.role || !hasRole(session.user.role, "SUPER_ADMIN")) {
    redirect("/dashboard/settings");
  }
  return <>{children}</>;
}
