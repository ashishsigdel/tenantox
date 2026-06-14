import { WorkspaceTransfer } from "@/components/builder/workspace-transfer";

export const metadata = { title: "Backup & Restore" };

export default function BackupSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Backup &amp; Restore</h1>
        <p className="text-sm text-muted-foreground">
          Export this workspace&apos;s configuration to a JSON file, or import
          one to recreate it on another deployment.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Workspace configuration</p>
            <p className="text-sm text-muted-foreground">
              Includes connections, resources &amp; fields, pages, and the menu.
            </p>
          </div>
          <WorkspaceTransfer />
        </div>
      </div>

      <ul className="space-y-1 text-sm text-muted-foreground">
        <li>
          • API-key secrets are <strong>not</strong> exported — re-enter them on
          each connection after importing.
        </li>
        <li>
          • Importing upserts connections, resources, and pages by their
          name/slug, and rebuilds the menu.
        </li>
      </ul>
    </div>
  );
}
