"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DynamicIcon } from "@/lib/icons";
import { deleteResource } from "@/server/actions/resources";

interface ResourceRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  connectionName: string;
  fieldCount: number;
}

export function ResourceListClient({
  resources,
}: {
  resources: ResourceRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      const result = await deleteResource(id);
      if (result.ok) {
        toast.success("Resource deleted");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Resource</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No resources yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
            {resources.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    <DynamicIcon
                      name={row.icon}
                      className="size-4 text-muted-foreground"
                    />
                    {row.name}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{row.slug}</TableCell>
                <TableCell>{row.connectionName}</TableCell>
                <TableCell>{row.fieldCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      asChild
                    >
                      <Link href={`/dashboard/r/${row.slug}`} title="Open list page">
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      asChild
                    >
                      <Link href={`/dashboard/settings/resources/${row.id}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => setDeleteId(row.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resource?</AlertDialogTitle>
            <AlertDialogDescription>
              The configuration (fields, menu links) will be removed. Data in
              the external API is not touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
