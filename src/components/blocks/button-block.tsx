"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useBlockAction } from "@/lib/data-provider";
import type { BlockDef, ButtonConfig } from "@/types/meta";

export function ButtonBlock({ block }: { block: BlockDef }) {
  const config = (block.config as ButtonConfig | null) ?? { label: "Run" };
  const [confirmOpen, setConfirmOpen] = useState(false);
  const action = useBlockAction(block.id);

  const run = () => {
    action.mutate(config.payload, {
      onSuccess: () => toast.success(config.successMessage ?? "Done"),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const onClick = () => {
    if (config.confirm) setConfirmOpen(true);
    else run();
  };

  return (
    <>
      <Button
        variant={config.variant ?? "default"}
        onClick={onClick}
        disabled={action.isPending}
      >
        {action.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : null}
        {config.label}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>{config.confirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={run}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
