"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/lib/icons";
import { deleteBlock, reorderBlocks } from "@/server/actions/pages";
import type { BlockDef } from "@/types/meta";
import type { BlockType } from "@prisma/client";

import {
  BLOCK_TYPES,
  blockSummary,
  blockTypeMeta,
} from "./block-types";
import { BlockEditorSheet } from "./block-editor-sheet";

type Connection = { id: string; name: string };
type ResourceOption = { id: string; name: string; slug: string };
type Editing = { block: BlockDef } | { newType: BlockType } | null;

function SortableBlockRow({
  block,
  onEdit,
  onDelete,
}: {
  block: BlockDef;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const meta = blockTypeMeta(block.type);

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
      <DynamicIcon name={meta.icon} className="size-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{meta.label}</span>
          <span className="truncate text-xs text-muted-foreground">
            {blockSummary(block)}
          </span>
        </div>
      </div>
      <Badge variant="outline" className="text-[10px]">
        {block.width}
      </Badge>
      {block.visibleToRoles && block.visibleToRoles.length > 0 ? (
        <Badge variant="secondary" className="text-[10px]">
          restricted
        </Badge>
      ) : null}
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

export function PageBuilderClient({
  pageId,
  blocks,
  connections,
  resources,
}: {
  pageId: string;
  blocks: BlockDef[];
  connections: Connection[];
  resources: ResourceOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [ordered, setOrdered] = useState(blocks);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockDef | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Keep local order in sync when the server refreshes the list.
  if (
    blocks.length !== ordered.length ||
    blocks.some((b) => !ordered.find((o) => o.id === b.id))
  ) {
    setOrdered(blocks);
  }

  // Notion-style: press "/" anywhere (outside inputs) to open the block menu.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable;
      if (typing) return;
      e.preventDefault();
      setMenuOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((b) => b.id === active.id);
    const newIndex = ordered.findIndex((b) => b.id === over.id);
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    startTransition(async () => {
      const result = await reorderBlocks(
        pageId,
        next.map((b) => b.id),
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
      const result = await deleteBlock(id);
      if (result.ok) {
        toast.success("Block deleted");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function pickType(type: BlockType) {
    setMenuOpen(false);
    setEditing({ newType: type });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Press{" "}
          <kbd className="rounded border bg-muted px-1.5 text-xs">/</kbd> or use
          the button to add a block. Drag to reorder.
        </p>
        <Button size="sm" onClick={() => setMenuOpen(true)}>
          <Plus className="size-4" /> Add block
        </Button>
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No blocks yet. Press <kbd className="rounded border px-1">/</kbd> to add
          your first block.
        </div>
      ) : (
        <DndContext
          id="page-block-builder"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={ordered.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {ordered.map((block) => (
                <SortableBlockRow
                  key={block.id}
                  block={block}
                  onEdit={() => setEditing({ block })}
                  onDelete={() => setDeleteTarget(block)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <CommandDialog open={menuOpen} onOpenChange={setMenuOpen}>
        <Command>
          <CommandInput placeholder="Search blocks…" />
          <CommandList>
            <CommandEmpty>No blocks found.</CommandEmpty>
            {(["Data", "Action", "Content"] as const).map((group) => (
              <CommandGroup key={group} heading={group}>
                {BLOCK_TYPES.filter((b) => b.group === group).map((b) => (
                  <CommandItem
                    key={b.type}
                    value={`${b.label} ${b.description}`}
                    onSelect={() => pickType(b.type)}
                  >
                    <DynamicIcon name={b.icon} className="size-4" />
                    <div className="flex flex-col">
                      <span>{b.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {b.description}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>

      <BlockEditorSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        pageId={pageId}
        block={editing && "block" in editing ? editing.block : null}
        newType={editing && "newType" in editing ? editing.newType : null}
        connections={connections}
        resources={resources}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this block?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the page. The external API data is not
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
    </div>
  );
}
