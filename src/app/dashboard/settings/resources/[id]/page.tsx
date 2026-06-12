import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { toResourceDef } from "@/lib/resources";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { FieldBuilder } from "@/components/builder/field-builder";
import { ResourceBasicsForm } from "@/components/builder/resource-basics-form";
import { ResourceForm } from "@/components/resource/resource-form";
import type { ResourceInput } from "@/server/actions/resources";

export const metadata = { title: "Resource Builder" };

export default async function ResourceBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  const [row, connections, allResources] = await Promise.all([
    prisma.resource.findUnique({
      where: { id },
      include: { fields: true },
    }),
    prisma.apiConnection.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.resource.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!row) notFound();

  const def = toResourceDef(row);
  const initial: ResourceInput = {
    id: def.id,
    name: def.name,
    slug: def.slug,
    icon: def.icon ?? "",
    apiConnectionId: def.apiConnectionId,
    endpoints: def.endpoints,
    primaryKeyField: def.primaryKeyField,
    titleField: def.titleField,
    capabilities: def.capabilities,
    permissions: def.permissions,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resource: {def.name}</h1>
        <p className="text-sm text-muted-foreground">
          Configure the API mapping, fields, and how the table and form render.
        </p>
      </div>

      <Tabs defaultValue={tab === "fields" ? "fields" : "basics"}>
        <TabsList>
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="fields">
            Fields ({def.fields.length})
          </TabsTrigger>
          <TabsTrigger value="preview">Form preview</TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="pt-4">
          <ResourceBasicsForm initial={initial} connections={connections} />
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
