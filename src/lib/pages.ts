import { prisma } from "@/lib/prisma";
import type {
  BlockConfig,
  BlockDataSource,
  BlockDef,
  BlockWidth,
  PageDef,
} from "@/types/meta";
import type { Block, Page, Role } from "@prisma/client";

/** Narrows a Block row's Json columns to their real types. */
export function toBlockDef(row: Block): BlockDef {
  return {
    id: row.id,
    type: row.type,
    order: row.order,
    width: row.width as BlockWidth,
    config: (row.config as BlockConfig) ?? null,
    dataSource: (row.dataSource as BlockDataSource | null) ?? null,
    visibleToRoles: (row.visibleToRoles as Role[] | null) ?? null,
  };
}

export function toPageDef(row: Page & { blocks: Block[] }): PageDef {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    description: row.description,
    viewRole: row.viewRole,
    blocks: row.blocks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toBlockDef),
  };
}

export async function getPageDef(slug: string): Promise<PageDef | null> {
  const row = await prisma.page.findUnique({
    where: { slug },
    include: { blocks: true },
  });
  return row ? toPageDef(row) : null;
}
