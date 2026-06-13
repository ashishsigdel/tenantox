import type { MenuItemType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface MenuNode {
  id: string;
  label: string;
  icon: string | null;
  type: MenuItemType;
  href: string | null;
  children: MenuNode[];
}

/** Loads the configured menu as a tree, filtered for the given role. */
export async function getMenuForRole(role: Role): Promise<MenuNode[]> {
  const items = await prisma.menuItem.findMany({
    orderBy: { order: "asc" },
    include: {
      resource: { select: { slug: true } },
      page: { select: { slug: true } },
    },
  });

  const visible = items.filter((item) => {
    const roles = item.visibleToRoles as Role[] | null;
    return !roles || roles.length === 0 || roles.includes(role);
  });

  const nodes = new Map<string, MenuNode>();
  for (const item of visible) {
    nodes.set(item.id, {
      id: item.id,
      label: item.label,
      icon: item.icon,
      type: item.type,
      href:
        item.type === "RESOURCE" && item.resource
          ? `/dashboard/r/${item.resource.slug}`
          : item.type === "PAGE" && item.page
            ? `/dashboard/p/${item.page.slug}`
            : item.href,
      children: [],
    });
  }

  const roots: MenuNode[] = [];
  for (const item of visible) {
    const node = nodes.get(item.id)!;
    const parent = item.parentId ? nodes.get(item.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
