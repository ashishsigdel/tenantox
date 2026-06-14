import { getWorkspaceContext } from "@/lib/session";
import { getMenuForRole } from "@/lib/menu";
import { listMyWorkspaces } from "@/server/actions/workspaces";
import { hasRole } from "@/lib/roles";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SettingsModal } from "@/components/layout/settings-modal";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getWorkspaceContext();

  const [menu, workspaces] = await Promise.all([
    getMenuForRole(ctx.workspaceId, ctx.role),
    listMyWorkspaces(),
  ]);

  const isAdmin = hasRole(ctx.role, "ADMIN");

  return (
    <SidebarProvider>
      <AppSidebar menu={menu} />
      <SidebarInset>
        <Topbar
          user={{ name: ctx.name, email: ctx.email, role: ctx.role }}
          workspaces={workspaces}
          activeWorkspaceId={ctx.workspaceId}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
      <SettingsModal isAdmin={isAdmin} />
    </SidebarProvider>
  );
}
