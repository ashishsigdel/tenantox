import { prisma } from "@/lib/prisma";
import { ResourceBasicsForm } from "@/components/builder/resource-basics-form";

export const metadata = { title: "New Resource" };

const DEFAULT_INPUT = {
  name: "",
  slug: "",
  icon: "",
  apiConnectionId: "",
  endpoints: {
    list: { method: "GET" as const, path: "/items" },
    getOne: { method: "GET" as const, path: "/items/{id}" },
    create: { method: "POST" as const, path: "/items" },
    update: { method: "PUT" as const, path: "/items/{id}" },
    delete: { method: "DELETE" as const, path: "/items/{id}" },
  },
  primaryKeyField: "id",
  titleField: "name",
  capabilities: { view: true, create: true, update: true, delete: true },
  permissions: {
    view: "VIEWER",
    create: "EDITOR",
    update: "EDITOR",
    delete: "ADMIN",
  },
} as const;

export default async function NewResourcePage() {
  const connections = await prisma.apiConnection.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Resource</h1>
        <p className="text-sm text-muted-foreground">
          Step 1 of 2: define the basics, then add fields.
        </p>
      </div>
      <ResourceBasicsForm
        initial={DEFAULT_INPUT}
        connections={connections}
        isNew
      />
    </div>
  );
}
