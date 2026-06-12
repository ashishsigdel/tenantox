"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CellRenderer } from "@/components/resource/cell-renderer";
import { ResourceForm } from "@/components/resource/resource-form";
import {
  DataApiError,
  useDeleteRecord,
  useRecord,
} from "@/lib/data-provider";
import { hasRole } from "@/lib/roles";
import type { ResourceDef } from "@/types/meta";
import type { Role } from "@prisma/client";

function LoadingState() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="flex h-48 items-center justify-center text-destructive">
      {error instanceof DataApiError ? error.message : "Failed to load record"}
    </div>
  );
}

/** Edit page body: loads the record, then renders the dynamic form. */
export function RecordEditor({
  resource,
  recordId,
}: {
  resource: ResourceDef;
  recordId: string;
}) {
  const { data, isLoading, error } = useRecord(resource.slug, recordId);
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} />;
  return (
    <ResourceForm resource={resource} record={data.data} recordId={recordId} />
  );
}

/** Read-only detail view with edit/delete actions. */
export function RecordDetail({
  resource,
  recordId,
  role,
}: {
  resource: ResourceDef;
  recordId: string;
  role: Role;
}) {
  const router = useRouter();
  const { data, isLoading, error } = useRecord(resource.slug, recordId);
  const deleteMutation = useDeleteRecord(resource.slug);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} />;

  const record = data.data;
  const canUpdate =
    resource.capabilities.update && hasRole(role, resource.permissions.update);
  const canDelete =
    resource.capabilities.delete && hasRole(role, resource.permissions.delete);

  async function onDelete() {
    setConfirmOpen(false);
    try {
      await deleteMutation.mutateAsync(recordId);
      toast.success("Record deleted");
      router.push(`/dashboard/r/${resource.slug}`);
    } catch (e) {
      toast.error(
        e instanceof DataApiError ? e.message : "Failed to delete record",
      );
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          {String(record[resource.titleField] ?? `#${recordId}`)}
        </h2>
        <div className="flex gap-2">
          {canUpdate && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/r/${resource.slug}/${recordId}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <dl>
            {resource.fields.map((field, i) => (
              <div key={field.id}>
                {i > 0 && <Separator />}
                <div className="grid gap-1 py-3 sm:grid-cols-3">
                  <dt className="text-sm font-medium text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="text-sm sm:col-span-2">
                    <CellRenderer field={field} value={record[field.key]} />
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
