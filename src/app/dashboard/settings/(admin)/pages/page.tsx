import Link from "next/link";
import { Plus } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { WorkspaceTransfer } from "@/components/builder/workspace-transfer";
import { PagesListClient } from "./pages-list-client";

export const metadata = { title: "Pages" };

export default async function PagesSettingsPage() {
  const rows = await prisma.page.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { blocks: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pages</h1>
          <p className="text-sm text-muted-foreground">
            Build custom pages from blocks — tables, charts, stats, and text —
            each bound to an API endpoint.
          </p>
        </div>
        <div className="flex gap-2">
          <WorkspaceTransfer />
          <Button size="sm" asChild>
            <Link href="/dashboard/settings/pages/new">
              <Plus className="size-4" /> New page
            </Link>
          </Button>
        </div>
      </div>

      <PagesListClient
        pages={rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          icon: row.icon,
          viewRole: row.viewRole,
          blockCount: row._count.blocks,
        }))}
      />
    </div>
  );
}
