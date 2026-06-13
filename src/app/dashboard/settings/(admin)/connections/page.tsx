import { prisma } from "@/lib/prisma";
import { ConnectionsClient } from "./connections-client";

export const metadata = { title: "API Connections" };

export default async function ConnectionsPage() {
  const rows = await prisma.apiConnection.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { resources: true } } },
  });

  const connections = rows.map((row) => ({
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    authType: row.authType,
    resourceCount: row._count.resources,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API Connections</h1>
        <p className="text-sm text-muted-foreground">
          External APIs that your resources read and write. Secrets are
          encrypted at rest and never sent to the browser.
        </p>
      </div>
      <ConnectionsClient connections={connections} />
    </div>
  );
}
