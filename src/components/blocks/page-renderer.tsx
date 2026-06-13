import { prisma } from "@/lib/prisma";
import { toResourceDef } from "@/lib/resources";
import { hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { isGroup } from "@/types/meta";
import type { BlockWidth, LayoutNode, PageDef, ResourceDef } from "@/types/meta";
import type { Role } from "@prisma/client";

import { BlockRenderer } from "./block-renderer";
import { GroupBlock } from "./group-block";

const WIDTH_CLASS: Record<BlockWidth, string> = {
  full: "md:col-span-6",
  half: "md:col-span-3",
  third: "md:col-span-2",
};

function canSee(node: LayoutNode, page: PageDef, role: Role): boolean {
  if (node.visibleToRoles && node.visibleToRoles.length > 0) {
    return node.visibleToRoles.includes(role);
  }
  return hasRole(role, page.viewRole);
}

/**
 * Server component: lays the page's blocks out in a 6-column grid, resolves the
 * Resource for each Table block, and delegates rendering per block type.
 */
export async function PageRenderer({
  page,
  role,
}: {
  page: PageDef;
  role: Role;
}) {
  const visible = page.layout.root.children.filter((n) => canSee(n, page, role));

  // Preload the ResourceDef for every top-level resource-backed Table block.
  // Tables inside a group are read-only (no resource), so they're skipped.
  const resourceIds = visible
    .filter(
      (n) =>
        !isGroup(n) &&
        n.type === "TABLE" &&
        n.dataSource?.mode === "resource",
    )
    .map((n) => (n.dataSource as { resourceId: string }).resourceId);

  const resources = resourceIds.length
    ? await prisma.resource.findMany({
        where: { id: { in: resourceIds } },
        include: { fields: true },
      })
    : [];
  const resourceById = new Map<string, ResourceDef>(
    resources.map((r) => [r.id, toResourceDef(r)]),
  );

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        This page has no blocks yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
      {visible.map((node) => (
        <div key={node.id} className={cn("min-w-0", WIDTH_CLASS[node.width])}>
          {isGroup(node) ? (
            <GroupBlock pageId={page.id} group={node} role={role} />
          ) : (
            <BlockRenderer
              pageId={page.id}
              block={node}
              role={role}
              resource={
                node.type === "TABLE" && node.dataSource?.mode === "resource"
                  ? resourceById.get(node.dataSource.resourceId) ?? null
                  : null
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
