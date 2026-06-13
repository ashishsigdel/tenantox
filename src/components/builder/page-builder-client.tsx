"use client";

import { useEffect, useRef, useState } from "react";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  Check,
  Copy,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { savePageLayout } from "@/server/actions/pages";
import { Markdown } from "@/components/blocks/markdown";
import { CalloutBlock } from "@/components/blocks/callout-block";
import type {
  BlockDef,
  CalloutConfig,
  HeadingConfig,
  PageLayout,
  TextConfig,
} from "@/types/meta";
import type { BlockType } from "@prisma/client";

import { BLOCK_TYPES, blockSummary, blockTypeMeta } from "./block-types";
import { BlockEditorSheet } from "./block-editor-sheet";

type Connection = { id: string; name: string };
type ResourceOption = { id: string; name: string; slug: string };
type Draft = Omit<BlockDef, "id">;
type Editing = { block: BlockDef } | { newType: BlockType; atIndex: number } | null;
type SaveStatus = "idle" | "saving" | "saved" | "error";

const WIDTH_CLASS: Record<BlockDef["width"], string> = {
  full: "md:col-span-6",
  half: "md:col-span-3",
  third: "md:col-span-2",
};

/** Returns a short reason the block is misconfigured, or null when it's fine. */
function blockIssue(block: BlockDef): string | null {
  const cfg = (block.config ?? {}) as Record<string, unknown>;
  const ds = block.dataSource;
  switch (block.type) {
    case "TABLE":
      return ds?.mode === "resource" && ds.resourceId
        ? null
        : "Not linked to a resource";
    case "CHART": {
      if (ds?.mode !== "raw" || !ds.connectionId || !ds.path)
        return "Needs a data source";
      const series = (cfg.series as { yPath?: string }[] | undefined) ?? [];
      return series.length && series.every((s) => s.yPath)
        ? null
        : "Series missing a value path";
    }
    case "STAT": {
      if (ds?.mode !== "raw" || !ds.connectionId || !ds.path)
        return "Needs a data source";
      const metrics =
        (cfg.metrics as { valuePath?: string; aggregate?: string }[] | undefined) ??
        [];
      return metrics.length ? null : "Add at least one metric";
    }
    case "BUTTON":
      return ds?.mode === "raw" && ds.connectionId && ds.path
        ? null
        : "Needs an endpoint";
    default:
      return null;
  }
}

/** Lightweight live preview used inside the builder canvas. */
function CanvasPreview({ block }: { block: BlockDef }) {
  const cfg = (block.config ?? {}) as Record<string, unknown>;
  switch (block.type) {
    case "HEADING": {
      const c = cfg as unknown as HeadingConfig;
      const sizes = {
        1: "text-2xl font-semibold",
        2: "text-xl font-semibold",
        3: "text-lg font-medium",
      } as const;
      return <div className={sizes[c.level ?? 2]}>{c.text || "Heading"}</div>;
    }
    case "TEXT":
      return <Markdown source={(cfg as unknown as TextConfig).markdown ?? ""} />;
    case "DIVIDER":
      return <hr className="my-1 border-border" />;
    case "CALLOUT":
      return (
        <CalloutBlock
          config={{
            text: (cfg.text as string) || "Callout text",
            tone: (cfg.tone as CalloutConfig["tone"]) ?? "info",
            icon: cfg.icon as string | undefined,
          }}
        />
      );
    default: {
      // Data blocks: a labeled placeholder (real data shows on the live page).
      const meta = blockTypeMeta(block.type);
      return (
        <div className="flex items-center gap-3 rounded-md border border-dashed bg-muted/40 px-3 py-4">
          <DynamicIcon name={meta.icon} className="size-5 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-medium">{meta.label}</div>
            <div className="truncate text-xs text-muted-foreground">
              {blockSummary(block)}
            </div>
          </div>
        </div>
      );
    }
  }
}

function SortableBlock({
  block,
  selected,
  onSelect,
  onEdit,
  onDuplicate,
  onInsertAfter,
  onDelete,
}: {
  block: BlockDef;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onInsertAfter: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const issue = blockIssue(block);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("col-span-1 min-w-0", WIDTH_CLASS[block.width])}
    >
      <div
        onClick={onSelect}
        className={cn(
          "group relative rounded-lg border bg-background p-3 transition-colors",
          selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/20",
          isDragging && "z-10 opacity-70 shadow-lg",
        )}
      >
        {/* hover toolbar */}
        <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border bg-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          <button
            className="cursor-grab touch-none p-1.5 text-muted-foreground"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag"
          >
            <GripVertical className="size-3.5" />
          </button>
          <ToolbarBtn label="Edit" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Duplicate" onClick={onDuplicate}>
            <Copy className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Insert below" onClick={onInsertAfter}>
            <Plus className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Delete" onClick={onDelete} destructive>
            <Trash2 className="size-3.5" />
          </ToolbarBtn>
        </div>

        <div className="mb-1 flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {block.width}
          </Badge>
          {block.visibleToRoles && block.visibleToRoles.length > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              restricted
            </Badge>
          ) : null}
          {issue ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3" /> {issue}
            </span>
          ) : null}
        </div>
        <CanvasPreview block={block} />
      </div>
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "p-1.5 text-muted-foreground hover:text-foreground",
        destructive && "hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

export function PageBuilderClient({
  pageId,
  layout,
  connections,
  resources,
}: {
  pageId: string;
  layout: PageLayout;
  connections: Connection[];
  resources: ResourceOption[];
}) {
  const rootId = layout.root.id;
  const [blocks, setBlocks] = useState<BlockDef[]>(layout.root.children);
  const [editing, setEditing] = useState<Editing>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockDef | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Debounced autosave: persist the whole tree ~600ms after the last edit.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setStatus("saving");
    const handle = setTimeout(async () => {
      const result = await savePageLayout(pageId, {
        version: 1,
        root: { id: rootId, kind: "section", children: blocks },
      });
      if (result.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        toast.error(result.error);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [blocks, pageId, rootId]);

  // Notion-style: press "/" (outside inputs) to open the block menu.
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
      setInsertAt(null);
      setMenuOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === active.id);
      const to = prev.findIndex((b) => b.id === over.id);
      return arrayMove(prev, from, to);
    });
  }

  function applyDraft(draft: Draft) {
    setBlocks((prev) => {
      if (editing && "block" in editing) {
        return prev.map((b) =>
          b.id === editing.block.id ? { ...draft, id: b.id } : b,
        );
      }
      const newBlock: BlockDef = { ...draft, id: crypto.randomUUID() };
      const at =
        editing && "atIndex" in editing ? editing.atIndex : prev.length;
      const next = prev.slice();
      next.splice(at, 0, newBlock);
      setSelectedId(newBlock.id);
      return next;
    });
  }

  function duplicate(block: BlockDef) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === block.id);
      const copy: BlockDef = { ...structuredClone(block), id: crypto.randomUUID() };
      const next = prev.slice();
      next.splice(i + 1, 0, copy);
      return next;
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setBlocks((prev) => prev.filter((b) => b.id !== deleteTarget.id));
    if (selectedId === deleteTarget.id) setSelectedId(null);
    setDeleteTarget(null);
  }

  function pickType(type: BlockType) {
    setMenuOpen(false);
    setEditing({ newType: type, atIndex: insertAt ?? blocks.length });
    setInsertAt(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Press <kbd className="rounded border bg-muted px-1.5 text-xs">/</kbd> or
          the button to add a block. Drag to reorder; click to edit.
        </p>
        <div className="flex items-center gap-3">
          <SaveIndicator status={status} />
          <Button
            size="sm"
            onClick={() => {
              setInsertAt(null);
              setMenuOpen(true);
            }}
          >
            <Plus className="size-4" /> Add block
          </Button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No blocks yet. Press{" "}
          <kbd className="rounded border px-1">/</kbd> to add your first block.
        </div>
      ) : (
        <DndContext
          id="page-block-builder"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              {blocks.map((block, i) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  selected={selectedId === block.id}
                  onSelect={() => setSelectedId(block.id)}
                  onEdit={() => {
                    setSelectedId(block.id);
                    setEditing({ block });
                  }}
                  onDuplicate={() => duplicate(block)}
                  onInsertAfter={() => {
                    setInsertAt(i + 1);
                    setMenuOpen(true);
                  }}
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
        block={editing && "block" in editing ? editing.block : null}
        newType={editing && "newType" in editing ? editing.newType : null}
        connections={connections}
        resources={resources}
        onSave={applyDraft}
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

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="size-3.5 text-green-600" /> Saved
      </span>
    );
  if (status === "error")
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertTriangle className="size-3.5" /> Save failed
      </span>
    );
  return null;
}
