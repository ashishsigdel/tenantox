import { prisma } from "@/lib/prisma";
import { MenuBuilderClient } from "./menu-builder-client";
import type { Role } from "@prisma/client";

export const metadata = { title: "Menu Builder" };

export default async function MenuSettingsPage() {
  const [items, resources] = await Promise.all([
    prisma.menuItem.findMany({ orderBy: { order: "asc" } }),
    prisma.resource.findMany({
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
          href: item.href,
          parentId: item.parentId,
          order: item.order,
          visibleToRoles: (item.visibleToRoles as Role[] | null) ?? [],
        }))}
        resources={resources}
      />
    </div>
  );
}
