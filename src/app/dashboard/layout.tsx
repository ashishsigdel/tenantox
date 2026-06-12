import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getMenuForRole } from "@/lib/menu";
import { hasRole } from "@/lib/roles";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const SETTINGS_LINKS = [
  { label: "Connections", href: "/dashboard/settings/connections", icon: "plug" },
  { label: "Resources", href: "/dashboard/settings/resources", icon: "database" },
  { label: "Menu", href: "/dashboard/settings/menu", icon: "list-tree" },
  { label: "Users", href: "/dashboard/settings/users", icon: "users" },
  { label: "Activity", href: "/dashboard/settings/activity", icon: "history" },
  { label: "API Docs", href: "/docs", icon: "book-open" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const menu = await getMenuForRole(session.user.role);
  const settingsLinks = hasRole(session.user.role, "ADMIN")
    ? SETTINGS_LINKS
    : [];

  return (
    <SidebarProvider>
      <AppSidebar menu={menu} settingsLinks={settingsLinks} />
      <SidebarInset>
        <Topbar
          user={{
            name: session.user.name,
            email: session.user.email,
            role: session.user.role,
          }}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
