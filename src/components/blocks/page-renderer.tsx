import { prisma } from "@/lib/prisma";
import { toResourceDef } from "@/lib/resources";
import { hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { BlockDef, PageDef, ResourceDef } from "@/types/meta";
import type { Role } from "@prisma/client";

import { BlockRenderer } from "./block-renderer";

const WIDTH_CLASS: Record<BlockDef["width"], string> = {
  full: "md:col-span-6",
  half: "md:col-span-3",
  third: "md:col-span-2",
};

function canSee(block: BlockDef, page: PageDef, role: Role): boolean {
  if (block.visibleToRoles && block.visibleToRoles.length > 0) {
    return block.visibleToRoles.includes(role);
  }
  return hasRole(role, page.viewRole);
}

/**
 * Server component: lays blocks out in a vertical 6-column grid, resolves the
 * Resource for each Table block, and delegates rendering per block type.
 */
export async function PageRenderer({
  page,
  role,
}: {
  page: PageDef;
  role: Role;
}) {
  const visible = page.blocks.filter((b) => canSee(b, page, role));

  // Preload the ResourceDef for every Table block.
  const resourceIds = visible
    .filter((b) => b.type === "TABLE" && b.dataSource?.mode === "resource")
    .map((b) => (b.dataSource as { resourceId: string }).resourceId);

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
      {visible.map((block) => {
        const resource =
          block.type === "TABLE" && block.dataSource?.mode === "resource"
            ? resourceById.get(block.dataSource.resourceId) ?? null
            : null;
        return (
          <div key={block.id} className={cn("min-w-0", WIDTH_CLASS[block.width])}>
            <BlockRenderer block={block} role={role} resource={resource} />
          </div>
        );
      })}
    </div>
  );
}
