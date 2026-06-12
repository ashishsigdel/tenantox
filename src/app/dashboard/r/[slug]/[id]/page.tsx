import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getResourceDef } from "@/lib/resources";
import { hasRole } from "@/lib/roles";
import { RecordDetail } from "@/components/resource/record-views";

export default async function RecordDetailPage({
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
    !resource.capabilities.view ||
    !hasRole(session.user.role, resource.permissions.view)
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        {resource.name.replace(/s$/, "")} details
      </h1>
      <RecordDetail resource={resource} recordId={id} role={session.user.role} />
    </div>
  );
}
