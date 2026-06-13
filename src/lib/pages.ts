import { prisma } from "@/lib/prisma";
import { emptyLayout, isGroup } from "@/types/meta";
import type {
  BlockDef,
  GroupDef,
  LayoutNode,
  PageDef,
  PageLayout,
} from "@/types/meta";
import type { Page } from "@prisma/client";

/** Defaults a missing `kind` to "block" and drops legacy `mode:"shared"` data
 * sources (groups replaced shared sources). */
function normalizeBlock(block: BlockDef): BlockDef {
  const ds = block.dataSource as { mode?: string } | null;
  const dataSource = ds && ds.mode === "shared" ? null : block.dataSource;
  return { ...block, kind: "block", dataSource };
}

function normalizeNode(node: LayoutNode): LayoutNode {
  if (node.kind === "group") {
    return { ...node, children: node.children.map(normalizeBlock) };
  }
  return normalizeBlock(node as BlockDef);
}

/** Narrows a Page row's `layout` Json column to a real PageLayout. */
export function toPageLayout(value: unknown): PageLayout {
  const layout = value as Partial<PageLayout> | null;
  if (layout && layout.root && Array.isArray(layout.root.children)) {
    return {
      version: 1,
      root: {
        ...layout.root,
        children: (layout.root.children as LayoutNode[]).map(normalizeNode),
      },
    };
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

/** Finds a node (block or group) by id anywhere in the layout tree. */
export function findNode(layout: PageLayout, id: string): LayoutNode | null {
  for (const node of layout.root.children) {
    if (node.id === id) return node;
    if (isGroup(node)) {
      const child = node.children.find((c) => c.id === id);
      if (child) return child;
    }
  }
  return null;
}

/** Finds a block leaf by id anywhere in the layout tree (top level or in a group). */
export function findBlock(layout: PageLayout, blockId: string): BlockDef | null {
  const node = findNode(layout, blockId);
  return node && !isGroup(node) ? (node as BlockDef) : null;
}

/** Finds the group that directly contains the given block id, if any. */
export function findParentGroup(
  layout: PageLayout,
  blockId: string,
): GroupDef | null {
  for (const node of layout.root.children) {
    if (isGroup(node) && node.children.some((c) => c.id === blockId)) {
      return node;
    }
  }
  return null;
}
