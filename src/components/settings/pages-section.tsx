"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PagesListClient } from "@/app/dashboard/settings/(admin)/pages/pages-list-client";
import { listPages, type PageRow } from "@/server/actions/pages";

export function PagesSection() {
  const [data, setData] = useState<PageRow[] | null>(null);

  const load = useCallback(async () => {
    const rows = await listPages();
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pages</h1>
          <p className="text-sm text-muted-foreground">
            Build custom pages from blocks — tables, charts, stats, and text — each bound to an API endpoint.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="?settings=pages&view=new">
            <Plus className="size-4" /> New page
          </Link>
        </Button>
      </div>
      <PagesListClient pages={data} onRefresh={load} />
    </div>
  );
}
