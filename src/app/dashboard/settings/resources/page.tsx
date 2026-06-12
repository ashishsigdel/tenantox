import Link from "next/link";
import { Plus } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { WorkspaceTransfer } from "@/components/builder/workspace-transfer";
import { ResourceListClient } from "./resource-list-client";

export const metadata = { title: "Resources" };

export default async function ResourcesSettingsPage() {
  const rows = await prisma.resource.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      apiConnection: { select: { name: true } },
      _count: { select: { fields: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Resources</h1>
          <p className="text-sm text-muted-foreground">
            Each resource maps an external API entity to a generated list page
            and form.
          </p>
        </div>
        <div className="flex gap-2">
          <WorkspaceTransfer />
          <Button size="sm" asChild>
            <Link href="/dashboard/settings/resources/new">
              <Plus className="size-4" /> New resource
            </Link>
          </Button>
        </div>
      </div>

      <ResourceListClient
        resources={rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          icon: row.icon,
          connectionName: row.apiConnection.name,
          fieldCount: row._count.fields,
        }))}
      />
    </div>
  );
}
