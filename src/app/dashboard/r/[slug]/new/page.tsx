import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getResourceDef } from "@/lib/resources";
import { hasRole } from "@/lib/roles";
import { ResourceForm } from "@/components/resource/resource-form";

export default async function NewRecordPage({
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
    !resource.capabilities.create ||
    !hasRole(session.user.role, resource.permissions.create)
  ) {
    redirect(`/dashboard/r/${slug}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        New {resource.name.replace(/s$/, "")}
      </h1>
      <ResourceForm resource={resource} />
    </div>
  );
}
