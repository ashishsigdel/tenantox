import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getMenuForRole } from "@/lib/menu";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const menu = await getMenuForRole(session.user.role);

  return (
    <SidebarProvider>
      <AppSidebar menu={menu} />
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
      {modal}
    </SidebarProvider>
  );
}
