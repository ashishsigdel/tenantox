import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getPageDef } from "@/lib/pages";
import { hasRole } from "@/lib/roles";
import { DynamicIcon } from "@/lib/icons";
import { PageRenderer } from "@/components/blocks/page-renderer";

export default async function CustomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const page = await getPageDef(slug);
  if (!page) notFound();

  if (!hasRole(session.user.role, page.viewRole)) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <DynamicIcon
            name={page.icon}
            className="size-6 text-muted-foreground"
          />
          <h1 className="text-2xl font-semibold">{page.name}</h1>
        </div>
        {page.description ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {page.description}
          </p>
        ) : null}
      </div>

      <PageRenderer page={page} role={session.user.role} />
    </div>
  );
}
