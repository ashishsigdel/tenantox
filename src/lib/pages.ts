import { prisma } from "@/lib/prisma";
import { emptyLayout } from "@/types/meta";
import type { PageDef, PageLayout } from "@/types/meta";
import type { Page } from "@prisma/client";

/** Narrows a Page row's `layout` Json column to a real PageLayout. */
export function toPageLayout(value: unknown): PageLayout {
  const layout = value as Partial<PageLayout> | null;
  if (layout && layout.root && Array.isArray(layout.root.children)) {
    return layout as PageLayout;
  }
  // Back-compat / corruption guard: hand back an empty tree.
  return emptyLayout(crypto.randomUUID());
}

export function toPageDef(row: Page): PageDef {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    description: row.description,
    viewRole: row.viewRole,
    layout: toPageLayout(row.layout),
  };
}

export async function getPageDef(
  workspaceId: string,
  slug: string,
): Promise<PageDef | null> {
  const row = await prisma.page.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } },
  });
  return row ? toPageDef(row) : null;
}

/** Finds a block leaf by id anywhere in a layout tree. */
export function findBlock(layout: PageLayout, blockId: string) {
  return layout.root.children.find((b) => b.id === blockId) ?? null;
}
