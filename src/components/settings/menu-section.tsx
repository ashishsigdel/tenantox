"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { MenuBuilderClient } from "@/app/dashboard/settings/(admin)/menu/menu-builder-client";
import { getMenuBuilderData, type MenuBuilderData } from "@/server/actions/menu";

export function MenuSection() {
  const [data, setData] = useState<MenuBuilderData | null>(null);

  const load = useCallback(async () => {
    const d = await getMenuBuilderData();
    setData(d);
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
        <h1 className="text-2xl font-semibold">Menu Builder</h1>
        <p className="text-sm text-muted-foreground">
          Arrange the sidebar. Drag to reorder; use groups to organize resource links.
        </p>
      </div>
      <MenuBuilderClient
        items={data.items}
        resources={data.resources}
        pages={data.pages}
        onRefresh={load}
      />
    </div>
  );
}
