"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { exportWorkspace, importWorkspace } from "@/server/actions/workspace";

export function WorkspaceTransfer() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onExport() {
    startTransition(async () => {
      try {
        const json = await exportWorkspace();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tenantox-workspace-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error("Export failed");
      }
    });
  }

  function onImportFile(file: File) {
    startTransition(async () => {
      const json = await file.text();
      const result = await importWorkspace(json);
      if (result.ok) {
        toast.success(
          "Workspace imported. Re-enter connection secrets if any were used.",
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onExport} disabled={pending}>
        <Download className="size-4" /> Export config
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        Import config
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
