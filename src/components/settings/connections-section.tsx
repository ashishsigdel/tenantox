"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ConnectionsClient } from "@/app/dashboard/settings/(admin)/connections/connections-client";
import { listConnections, type ConnectionRow } from "@/server/actions/connections";

export function ConnectionsSection() {
  const [data, setData] = useState<ConnectionRow[] | null>(null);

  const load = useCallback(async () => {
    const rows = await listConnections();
    setData(rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API Connections</h1>
        <p className="text-sm text-muted-foreground">
          External APIs that your resources read and write. Secrets are encrypted at rest and never sent to the browser.
        </p>
      </div>
      <ConnectionsClient connections={data} onRefresh={load} />
    </div>
  );
}
