import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasRole } from "@/lib/roles";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, "ADMIN")) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
