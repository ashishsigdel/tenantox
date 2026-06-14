"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { FieldBuilder } from "@/components/builder/field-builder";
import { ResourceBasicsForm } from "@/components/builder/resource-basics-form";
import { ResourceForm } from "@/components/resource/resource-form";
import { getResourceForBuilder } from "@/server/actions/resources";

type Data = Awaited<ReturnType<typeof getResourceForBuilder>>;

export function ResourceBuilderSection() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = searchParams.get("id") ?? "";
  const tab = searchParams.get("tab") ?? "basics";

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(null);
      setError(null);
      const d = await getResourceForBuilder(id);
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
      router.replace(`${pathname}?settings=resources&id=${newId}&tab=fields`);
    },
    [router, pathname],
  );

  if (!id) {
    return (
      <p className="text-sm text-muted-foreground">No resource selected.</p>
    );
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

  const { def, initial, connections, allResources } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resource: {def.name}</h1>
        <p className="text-sm text-muted-foreground">
          Configure the API mapping, fields, and how the table and form render.
        </p>
      </div>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="fields">Fields ({def.fields.length})</TabsTrigger>
          <TabsTrigger value="preview">Form preview</TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="pt-4">
          <ResourceBasicsForm
            initial={initial}
            connections={connections}
            onCreated={onCreated}
          />
        </TabsContent>

        <TabsContent value="fields" className="pt-4">
          <FieldBuilder
            resourceId={def.id}
            fields={def.fields}
            resourceOptions={allResources.filter((r) => r.slug !== def.slug)}
          />
        </TabsContent>

        <TabsContent value="preview" className="pt-4">
          <div className="max-w-3xl rounded-lg border p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              This is exactly what the create form renders for end users.
              Submitting validates but sends nothing.
            </p>
            <ResourceForm resource={def} preview />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
