import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getResourceDef } from "@/lib/resources";
import { hasRole } from "@/lib/roles";
import { DynamicIcon } from "@/lib/icons";
import { ResourceTable } from "@/components/resource/resource-table";

export default async function ResourceListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const resource = await getResourceDef(slug);
  if (!resource) notFound();

  if (
    !resource.capabilities.view ||
    !hasRole(session.user.role, resource.permissions.view)
  ) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        You don&apos;t have permission to view this resource.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DynamicIcon
          name={resource.icon}
          className="size-6 text-muted-foreground"
        />
        <h1 className="text-2xl font-semibold">{resource.name}</h1>
      </div>
      <ResourceTable resource={resource} role={session.user.role} />
    </div>
  );
}
