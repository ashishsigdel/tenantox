import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { toPageDef } from "@/lib/pages";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageBuilderClient } from "@/components/builder/page-builder-client";
import { PageSettingsForm } from "@/components/builder/page-settings-form";
import type { PageInput } from "@/server/actions/pages";

export const metadata = { title: "Page Builder" };

export default async function PageBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row, connections, resources] = await Promise.all([
    prisma.page.findUnique({ where: { id }, include: { blocks: true } }),
    prisma.apiConnection.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.resource.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!row) notFound();

  const page = toPageDef(row);
  const initial: PageInput = {
    id: page.id,
    name: page.name,
    slug: page.slug,
    icon: page.icon ?? "",
    description: page.description ?? "",
    viewRole: page.viewRole,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Page: {page.name}</h1>
          <p className="text-sm text-muted-foreground">
            Compose blocks and configure their data. Drag to reorder.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/p/${page.slug}`} target="_blank">
            <ExternalLink className="size-4" /> View page
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">
            Builder ({page.blocks.length})
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="pt-4">
          <PageBuilderClient
            pageId={page.id}
            blocks={page.blocks}
            connections={connections}
            resources={resources}
          />
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <PageSettingsForm initial={initial} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
