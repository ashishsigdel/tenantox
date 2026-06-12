"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
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
import { FieldEditorSheet } from "@/components/builder/field-editor-sheet";
import { deleteField, reorderFields } from "@/server/actions/resources";
import type { FieldDef } from "@/types/meta";

function SortableFieldRow({
  field,
  onEdit,
  onDelete,
}: {
  field: FieldDef;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border bg-background p-2 ${
        isDragging ? "z-10 opacity-70 shadow-lg" : ""
      }`}
    >
      <button
        className="cursor-grab touch-none p-1 text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="Reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{field.label}</span>
          <code className="rounded bg-muted px-1 text-xs">{field.key}</code>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <Badge variant="secondary" className="text-[10px]">
            {field.type}
          </Badge>
          {field.validation?.required && (
            <Badge variant="secondary" className="text-[10px]">
              required
            </Badge>
          )}
          {!field.showInForm && (
            <Badge variant="outline" className="text-[10px]">
              hidden in form
            </Badge>
          )}
          {field.showInTable && (
            <Badge variant="outline" className="text-[10px]">
              table: {field.format}
            </Badge>
          )}
          {field.visibleIf && (
            <Badge variant="outline" className="text-[10px]">
              conditional
            </Badge>
          )}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="size-8" onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function FieldBuilder({
  resourceId,
  fields,
  resourceOptions,
}: {
  resourceId: string;
  fields: FieldDef[];
  /** Other resources, for RELATION / dynamic options config. */
  resourceOptions: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [ordered, setOrdered] = useState(fields);
  const [editing, setEditing] = useState<FieldDef | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<FieldDef | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Keep local order in sync when the server refreshes the list.
  if (
    fields.length !== ordered.length ||
    fields.some((f) => !ordered.find((o) => o.id === f.id))
  ) {
    setOrdered(fields);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((f) => f.id === active.id);
    const newIndex = ordered.findIndex((f) => f.id === over.id);
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    startTransition(async () => {
      const result = await reorderFields(
        resourceId,
        next.map((f) => f.id),
        "form",
      );
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteField(id);
      if (result.ok) {
        toast.success("Field deleted");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Drag to set the form order. Table column order follows separately via
          each field&apos;s settings.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Add field
        </Button>
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No fields yet. Add your first field to define the form and table.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={ordered.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {ordered.map((field) => (
                <SortableFieldRow
                  key={field.id}
                  field={field}
                  onEdit={() => setEditing(field)}
                  onDelete={() => setDeleteTarget(field)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <FieldEditorSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        resourceId={resourceId}
        field={editing === "new" ? null : editing}
        existingKeys={ordered.map((f) => f.key)}
        resourceOptions={resourceOptions}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete field “{deleteTarget?.label}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It will disappear from the form and table. Data in the external
              API is not touched.
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
    </div>
  );
}
