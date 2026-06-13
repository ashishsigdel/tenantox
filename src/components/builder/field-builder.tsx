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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function TableColumnRow({
  field,
  onEdit,
}: {
  field: FieldDef;
  onEdit: () => void;
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
          <Badge variant="outline" className="text-[10px]">
            {field.format}
          </Badge>
          {field.sortable && (
            <Badge variant="secondary" className="text-[10px]">
              sortable
            </Badge>
          )}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="size-8" onClick={onEdit}>
        <Pencil className="size-4" />
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
  resourceOptions: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [formOrdered, setFormOrdered] = useState(fields);
  const [tableOrdered, setTableOrdered] = useState(
    [...fields].filter((f) => f.showInTable).sort((a, b) => a.tableOrder - b.tableOrder),
  );
  const [editing, setEditing] = useState<FieldDef | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<FieldDef | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Keep local lists in sync when server refreshes.
  if (
    fields.length !== formOrdered.length ||
    fields.some((f) => !formOrdered.find((o) => o.id === f.id))
  ) {
    setFormOrdered(fields);
    setTableOrdered(
      [...fields].filter((f) => f.showInTable).sort((a, b) => a.tableOrder - b.tableOrder),
    );
  }

  function onFormDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = formOrdered.findIndex((f) => f.id === active.id);
    const newIndex = formOrdered.findIndex((f) => f.id === over.id);
    const next = arrayMove(formOrdered, oldIndex, newIndex);
    setFormOrdered(next);
    startTransition(async () => {
      const result = await reorderFields(resourceId, next.map((f) => f.id), "form");
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  function onTableDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tableOrdered.findIndex((f) => f.id === active.id);
    const newIndex = tableOrdered.findIndex((f) => f.id === over.id);
    const next = arrayMove(tableOrdered, oldIndex, newIndex);
    setTableOrdered(next);
    startTransition(async () => {
      const result = await reorderFields(resourceId, next.map((f) => f.id), "table");
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
          Drag to reorder form fields or table columns independently.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Add field
        </Button>
      </div>

      <Tabs defaultValue="form">
        <TabsList>
          <TabsTrigger value="form">Form order</TabsTrigger>
          <TabsTrigger value="table">
            Table columns
            {tableOrdered.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">
                {tableOrdered.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="mt-4">
          {formOrdered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No fields yet. Add your first field to define the form and table.
            </div>
          ) : (
            <DndContext
              id="field-form-order"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onFormDragEnd}
            >
              <SortableContext
                items={formOrdered.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {formOrdered.map((field) => (
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
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          {tableOrdered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No fields marked to show in table. Edit a field and enable "Show in table".
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Drag to set the left-to-right column order in the table.
              </p>
              <DndContext
                id="field-table-order"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onTableDragEnd}
              >
                <SortableContext
                  items={tableOrdered.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {tableOrdered.map((field) => (
                      <TableColumnRow
                        key={field.id}
                        field={field}
                        onEdit={() => setEditing(field)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </TabsContent>
      </Tabs>

      <FieldEditorSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        resourceId={resourceId}
        field={editing === "new" ? null : editing}
        existingKeys={formOrdered.map((f) => f.key)}
        resourceOptions={resourceOptions}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete field "{deleteTarget?.label}"?
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
