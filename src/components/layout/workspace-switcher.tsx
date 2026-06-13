"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspace } from "@/server/actions/workspaces";

type Workspace = { id: string; name: string; slug: string; role: string };

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  const active =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  function switchTo(id: string) {
    if (id === activeWorkspaceId) return;
    startTransition(async () => {
      await update({ activeWorkspaceId: id });
      router.refresh();
    });
  }

  function submitCreate() {
    startTransition(async () => {
      const result = await createWorkspace({ name });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreateOpen(false);
      setName("");
      if (result.id) {
        await update({ activeWorkspaceId: result.id });
      }
      toast.success("Workspace created");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <div className="flex size-6 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
                {(active?.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
              {active?.name ?? "No workspace"}
            </span>
            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onClick={() => switchTo(w.id)}
              className="gap-2"
            >
              <div className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold">
                {w.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{w.name}</div>
                <div className="text-[10px] text-muted-foreground">{w.role}</div>
              </div>
              {w.id === active?.id && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" /> New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              onKeyDown={(e) => e.key === "Enter" && name && submitCreate()}
            />
          </div>
          <DialogFooter>
            <Button onClick={submitCreate} disabled={pending || !name}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
