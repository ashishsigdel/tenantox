"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageBuilderClient } from "@/components/builder/page-builder-client";
import { PageSettingsForm } from "@/components/builder/page-settings-form";
import { getPageForBuilder } from "@/server/actions/pages";

type Data = Awaited<ReturnType<typeof getPageForBuilder>>;

export function PageBuilderSection() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = searchParams.get("id") ?? "";
  const tab = searchParams.get("tab") ?? "builder";

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(null);
      setError(null);
      const d = await getPageForBuilder(id);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onCreated = useCallback(
    (newId: string) => {
      router.replace(`${pathname}?settings=pages&id=${newId}`);
    },
    [router, pathname],
  );

  if (!id) {
    return <p className="text-sm text-muted-foreground">No page selected.</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { page, initial, connections, resources } = data;

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

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="builder">
            Builder ({page.layout.root.children.length})
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="pt-4">
          <PageBuilderClient
            pageId={page.id}
            layout={page.layout}
            connections={connections}
            resources={resources}
          />
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <PageSettingsForm initial={initial} onCreated={onCreated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
