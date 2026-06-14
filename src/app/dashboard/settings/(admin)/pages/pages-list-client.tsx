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
import { Badge } from "@/components/ui/badge";
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
import { deletePage } from "@/server/actions/pages";
import type { Role } from "@prisma/client";

interface PageRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  viewRole: Role;
  blockCount: number;
}

export function PagesListClient({
  pages,
  onRefresh,
}: {
  pages: PageRow[];
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<PageRow | null>(null);

  function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deletePage(id);
      if (result.ok) {
        toast.success("Page deleted");
        router.refresh();
        onRefresh?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (pages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No pages yet. Create your first custom page to get started.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Blocks</TableHead>
              <TableHead>Min role</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page) => (
              <TableRow key={page.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    <DynamicIcon
                      name={page.icon}
                      className="size-4 text-muted-foreground"
                    />
                    {page.name}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1 text-xs">
                    {page.slug}
                  </code>
                </TableCell>
                <TableCell>{page.blockCount}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{page.viewRole}+</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <Link href={`/dashboard/p/${page.slug}`} target="_blank">
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <Link href={`?settings=pages&id=${page.id}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => setDeleteTarget(page)}
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
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete page “{deleteTarget?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All of its blocks will be removed. The external API data is not
              touched.
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
