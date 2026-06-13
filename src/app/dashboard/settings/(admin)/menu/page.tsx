import { getWorkspaceContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MenuBuilderClient } from "./menu-builder-client";
import type { Role } from "@prisma/client";

export const metadata = { title: "Menu Builder" };

export default async function MenuSettingsPage() {
  const ctx = await getWorkspaceContext();
  const where = { workspaceId: ctx.workspaceId };
  const [items, resources, pages] = await Promise.all([
    prisma.menuItem.findMany({ where, orderBy: { order: "asc" } }),
    prisma.resource.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.page.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Menu Builder</h1>
        <p className="text-sm text-muted-foreground">
          Arrange the sidebar. Drag to reorder; use groups to organize resource
          links.
        </p>
      </div>
      <MenuBuilderClient
        items={items.map((item) => ({
          id: item.id,
          label: item.label,
          icon: item.icon,
          type: item.type,
          resourceId: item.resourceId,
          pageId: item.pageId,
          href: item.href,
          parentId: item.parentId,
          order: item.order,
          visibleToRoles: (item.visibleToRoles as Role[] | null) ?? [],
        }))}
        resources={resources}
        pages={pages}
      />
    </div>
  );
}
