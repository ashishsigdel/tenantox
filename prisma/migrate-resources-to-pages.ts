/**
 * One-off, idempotent migration: wrap every existing Resource in a Page that
 * contains a single full-width Table block, then repoint RESOURCE menu items to
 * the new Page. Run once after unifying Resources into the Pages builder:
 *
 *   npx tsx prisma/migrate-resources-to-pages.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Permissions = { view?: string };

async function main() {
  const resources = await prisma.resource.findMany();
  const resourceIdToPageId = new Map<string, string>();

  for (const resource of resources) {
    // Reuse a page on the same slug if it already exists (idempotent).
    let page = await prisma.page.findUnique({ where: { slug: resource.slug } });

    if (!page) {
      const perms = (resource.permissions as Permissions) ?? {};
      const viewRole = (perms.view as
        | "SUPER_ADMIN"
        | "ADMIN"
        | "EDITOR"
        | "VIEWER"
        | undefined) ?? "VIEWER";

      page = await prisma.page.create({
        data: {
          name: resource.name,
          slug: resource.slug,
          icon: resource.icon,
          viewRole,
          blocks: {
            create: {
              type: "TABLE",
              order: 0,
              width: "full",
              dataSource: { mode: "resource", resourceId: resource.id },
            },
          },
        },
      });
      console.log(`Created page "${page.slug}" for resource "${resource.name}"`);
    } else {
      console.log(`Page "${page.slug}" already exists — skipping create`);
    }

    resourceIdToPageId.set(resource.id, page.id);
  }

  // Repoint RESOURCE menu items to the corresponding PAGE.
  const resourceMenuItems = await prisma.menuItem.findMany({
    where: { type: "RESOURCE" },
  });
  for (const item of resourceMenuItems) {
    const pageId = item.resourceId
      ? resourceIdToPageId.get(item.resourceId)
      : undefined;
    if (!pageId) {
      console.warn(`Menu item "${item.label}" has no matching page — skipping`);
      continue;
    }
    await prisma.menuItem.update({
      where: { id: item.id },
      data: { type: "PAGE", pageId, resourceId: null },
    });
    console.log(`Repointed menu item "${item.label}" → page`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
