import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getResourceDef } from "@/lib/resources";
import { hasRole } from "@/lib/roles";
import { RecordEditor } from "@/components/resource/record-views";

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug, id } = await params;
  const resource = await getResourceDef(slug);
  if (!resource) notFound();

  if (
    !resource.capabilities.update ||
    !hasRole(session.user.role, resource.permissions.update)
  ) {
    redirect(`/dashboard/r/${slug}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Edit {resource.name.replace(/s$/, "")}
      </h1>
      <RecordEditor resource={resource} recordId={id} />
    </div>
  );
}
