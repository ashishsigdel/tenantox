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
import { isGroup } from "@/types/meta";
import type {
  BlockDef,
  CalloutConfig,
  GroupDef,
  HeadingConfig,
  LayoutNode,
  PageLayout,
  TextConfig,
} from "@/types/meta";
import type { BlockType } from "@prisma/client";

import {
  BLOCK_TYPES,
  GROUP_META,
  blockSummary,
  blockTypeMeta,
  type InsertKind,
} from "./block-types";
import { BlockEditorSheet, type EditorTarget } from "./block-editor-sheet";

type Connection = { id: string; name: string };
type ResourceOption = { id: string; name: string; slug: string };
type BlockDraft = Omit<BlockDef, "id">;
type GroupDraft = Omit<GroupDef, "id">;
type SaveStatus = "idle" | "saving" | "saved" | "error";

type Editing =
  | { kind: "block"; block: BlockDef; groupId: string | null }
  | { kind: "newBlock"; type: BlockType; atIndex: number; groupId: string | null }
  | { kind: "group"; group: GroupDef }
  | { kind: "newGroup"; atIndex: number }
  | null;

type MenuTarget = { groupId: string | null; atIndex: number };
type DeleteTarget = { node: LayoutNode; groupId: string | null } | null;

const WIDTH_CLASS: Record<BlockDef["width"], string> = {
  full: "md:col-span-6",
  half: "md:col-span-3",
  third: "md:col-span-2",
};

/** Returns a short reason a block is misconfigured, or null when it's fine. */
function blockIssue(block: BlockDef): string | null {
  const cfg = (block.config ?? {}) as Record<string, unknown>;
  const ds = block.dataSource;
  const bound =
    ds?.mode === "group" || (ds?.mode === "raw" && !!ds.connectionId && !!ds.path);
  switch (block.type) {
    case "TABLE":
      if (ds?.mode === "group") return null;
      return ds?.mode === "resource" && ds.resourceId
        ? null
        : "Not linked to a resource";
    case "CHART": {
      if (!bound) return "Needs a data source";
      const series = (cfg.series as { yPath?: string }[] | undefined) ?? [];
      return series.length && series.every((s) => s.yPath)
        ? null
        : "Series missing a value path";
    }
    case "STAT": {
      if (!bound) return "Needs a data source";
      const metrics = (cfg.metrics as unknown[] | undefined) ?? [];
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

function groupIssue(group: GroupDef): string | null {
  if (!group.source || !group.source.connectionId || !group.source.path) {
    return "Needs a data source";
  }
  if (group.children.length === 0) return "Empty group";
  return null;
}

/** Lightweight live preview used inside the builder canvas for content blocks. */
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

type BlockActions = {
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onInsertAfter: () => void;
  onDelete: () => void;
};

function BlockCard({
  block,
  grid,
  ...actions
}: { block: BlockDef; grid: boolean } & BlockActions) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const issue = blockIssue(block);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("col-span-1 min-w-0", grid && WIDTH_CLASS[block.width])}
    >
      <div
        onClick={actions.onSelect}
        className={cn(
          "group relative rounded-lg border bg-background p-3 transition-colors",
          actions.selected
            ? "border-primary ring-1 ring-primary"
            : "hover:border-foreground/20",
          isDragging && "z-10 opacity-70 shadow-lg",
        )}
      >
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
          <ToolbarBtn label="Edit" onClick={actions.onEdit}>
            <Pencil className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Duplicate" onClick={actions.onDuplicate}>
            <Copy className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Insert below" onClick={actions.onInsertAfter}>
            <Plus className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Delete" onClick={actions.onDelete} destructive>
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

function GroupCard({
  group,
  selected,
  onSelect,
  onEdit,
  onDuplicate,
  onInsertAfter,
  onDelete,
  onAddChild,
  childActions,
  onChildDragEnd,
  sensors,
}: {
  group: GroupDef;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onInsertAfter: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  childActions: (child: BlockDef, index: number) => BlockActions;
  onChildDragEnd: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });
  const issue = groupIssue(group);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("col-span-1 min-w-0", WIDTH_CLASS[group.width])}
    >
      <div
        onClick={onSelect}
        className={cn(
          "group/grp relative rounded-lg border-2 border-dashed bg-muted/20 p-3 transition-colors",
          selected ? "border-primary" : "hover:border-foreground/20",
          isDragging && "z-10 opacity-70 shadow-lg",
        )}
      >
        <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border bg-background opacity-0 shadow-sm transition-opacity group-hover/grp:opacity-100">
          <button
            className="cursor-grab touch-none p-1.5 text-muted-foreground"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag"
          >
            <GripVertical className="size-3.5" />
          </button>
          <ToolbarBtn label="Edit group" onClick={onEdit}>
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

        <div className="mb-2 flex items-center gap-2">
          <DynamicIcon name={GROUP_META.icon} className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {group.config.title || "Group"}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {group.config.columns ?? 2} col
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono">
            {group.source?.path || "no source"}
          </Badge>
          {issue ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3" /> {issue}
            </span>
          ) : null}
        </div>

        {group.children.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
            Empty group — add blocks that read from its API call.
          </div>
        ) : (
          <DndContext
            id={`group-${group.id}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onChildDragEnd}
          >
            <SortableContext
              items={group.children.map((c) => c.id)}
              strategy={rectSortingStrategy}
            >
              <div className="space-y-2">
                {group.children.map((child, i) => (
                  <BlockCard
                    key={child.id}
                    block={child}
                    grid={false}
                    {...childActions(child, i)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
        >
          <Plus className="size-4" /> Add block to group
        </Button>
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

/** Deep-clones a node with fresh ids (group children get new ids too). */
function cloneNode(node: LayoutNode): LayoutNode {
  if (isGroup(node)) {
    return {
      ...structuredClone(node),
      id: crypto.randomUUID(),
      children: node.children.map((c) => ({
        ...structuredClone(c),
        id: crypto.randomUUID(),
      })),
    };
  }
  return { ...structuredClone(node), id: crypto.randomUUID() };
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
  const [nodes, setNodes] = useState<LayoutNode[]>(layout.root.children);
  const [editing, setEditing] = useState<Editing>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
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
        root: { id: rootId, kind: "section", children: nodes },
      });
      if (result.ok) setStatus("saved");
      else {
        setStatus("error");
        toast.error(result.error);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [nodes, pageId, rootId]);

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
      setMenuTarget(null);
      setMenuOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* --------------------------- tree mutations ---------------------------- */

  const insertTop = (at: number, node: LayoutNode) =>
    setNodes((prev) => {
      const next = prev.slice();
      next.splice(at, 0, node);
      return next;
    });

  const updateTop = (id: string, fn: (n: LayoutNode) => LayoutNode) =>
    setNodes((prev) => prev.map((n) => (n.id === id ? fn(n) : n)));

  const insertChild = (groupId: string, at: number, block: BlockDef) =>
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== groupId || !isGroup(n)) return n;
        const children = n.children.slice();
        children.splice(at, 0, block);
        return { ...n, children };
      }),
    );

  const updateChild = (
    groupId: string,
    blockId: string,
    fn: (b: BlockDef) => BlockDef,
  ) =>
    setNodes((prev) =>
      prev.map((n) =>
        n.id === groupId && isGroup(n)
          ? { ...n, children: n.children.map((c) => (c.id === blockId ? fn(c) : c)) }
          : n,
      ),
    );

  function onTopDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setNodes((prev) => {
      const from = prev.findIndex((n) => n.id === active.id);
      const to = prev.findIndex((n) => n.id === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function onGroupDragEnd(groupId: string) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== groupId || !isGroup(n)) return n;
          const from = n.children.findIndex((c) => c.id === active.id);
          const to = n.children.findIndex((c) => c.id === over.id);
          if (from === -1 || to === -1) return n;
          return { ...n, children: arrayMove(n.children, from, to) };
        }),
      );
    };
  }

  function applyDraft(draft: BlockDraft | GroupDraft) {
    if (!editing) return;
    if (draft.kind === "group") {
      if (editing.kind === "group") {
        const id = editing.group.id;
        updateTop(id, () => ({ ...(draft as GroupDraft), id }));
      } else if (editing.kind === "newGroup") {
        const g: GroupDef = { ...(draft as GroupDraft), id: crypto.randomUUID() };
        insertTop(editing.atIndex, g);
        setSelectedId(g.id);
      }
      return;
    }
    const blockDraft = draft as BlockDraft;
    if (editing.kind === "block") {
      const id = editing.block.id;
      if (editing.groupId) updateChild(editing.groupId, id, () => ({ ...blockDraft, id }));
      else updateTop(id, () => ({ ...blockDraft, id }));
    } else if (editing.kind === "newBlock") {
      const b: BlockDef = { ...blockDraft, id: crypto.randomUUID() };
      if (editing.groupId) insertChild(editing.groupId, editing.atIndex, b);
      else insertTop(editing.atIndex, b);
      setSelectedId(b.id);
    }
  }

  function duplicateTop(node: LayoutNode) {
    setNodes((prev) => {
      const i = prev.findIndex((n) => n.id === node.id);
      const next = prev.slice();
      next.splice(i + 1, 0, cloneNode(node));
      return next;
    });
  }

  function duplicateChild(groupId: string, block: BlockDef) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== groupId || !isGroup(n)) return n;
        const i = n.children.findIndex((c) => c.id === block.id);
        const copy: BlockDef = { ...structuredClone(block), id: crypto.randomUUID() };
        const children = n.children.slice();
        children.splice(i + 1, 0, copy);
        return { ...n, children };
      }),
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const { node, groupId } = deleteTarget;
    if (groupId) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === groupId && isGroup(n)
            ? { ...n, children: n.children.filter((c) => c.id !== node.id) }
            : n,
        ),
      );
    } else {
      setNodes((prev) => prev.filter((n) => n.id !== node.id));
    }
    if (selectedId === node.id) setSelectedId(null);
    setDeleteTarget(null);
  }

  function pick(kind: InsertKind) {
    setMenuOpen(false);
    const target = menuTarget ?? { groupId: null, atIndex: nodes.length };
    if (kind === "GROUP") {
      setEditing({ kind: "newGroup", atIndex: target.atIndex });
    } else {
      setEditing({
        kind: "newBlock",
        type: kind,
        atIndex: target.atIndex,
        groupId: target.groupId,
      });
    }
    setMenuTarget(null);
  }

  function childActions(group: GroupDef, child: BlockDef, index: number): BlockActions {
    return {
      selected: selectedId === child.id,
      onSelect: () => setSelectedId(child.id),
      onEdit: () => {
        setSelectedId(child.id);
        setEditing({ kind: "block", block: child, groupId: group.id });
      },
      onDuplicate: () => duplicateChild(group.id, child),
      onInsertAfter: () => {
        setMenuTarget({ groupId: group.id, atIndex: index + 1 });
        setMenuOpen(true);
      },
      onDelete: () => setDeleteTarget({ node: child, groupId: group.id }),
    };
  }

  // The editor target derived from the current `editing` state.
  const editorTarget: EditorTarget | null = !editing
    ? null
    : editing.kind === "group"
      ? { mode: "group", group: editing.group }
      : editing.kind === "newGroup"
        ? { mode: "group", group: null }
        : editing.kind === "block"
          ? { mode: "block", block: editing.block, newType: null, inGroup: !!editing.groupId }
          : { mode: "block", block: null, newType: editing.type, inGroup: !!editing.groupId };

  // The parent group's source, when editing a block inside a group.
  const editingGroupId =
    editing && (editing.kind === "block" || editing.kind === "newBlock")
      ? editing.groupId
      : null;
  const editorGroupSource =
    editingGroupId != null
      ? (nodes.find((n) => n.id === editingGroupId && isGroup(n)) as GroupDef | undefined)
          ?.source ?? null
      : null;

  const showGroupOption = (menuTarget?.groupId ?? null) === null;

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
              setMenuTarget(null);
              setMenuOpen(true);
            }}
          >
            <Plus className="size-4" /> Add block
          </Button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No blocks yet. Press{" "}
          <kbd className="rounded border px-1">/</kbd> to add your first block.
        </div>
      ) : (
        <DndContext
          id="page-node-builder"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onTopDragEnd}
        >
          <SortableContext
            items={nodes.map((n) => n.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              {nodes.map((node, i) =>
                isGroup(node) ? (
                  <GroupCard
                    key={node.id}
                    group={node}
                    selected={selectedId === node.id}
                    onSelect={() => setSelectedId(node.id)}
                    onEdit={() => {
                      setSelectedId(node.id);
                      setEditing({ kind: "group", group: node });
                    }}
                    onDuplicate={() => duplicateTop(node)}
                    onInsertAfter={() => {
                      setMenuTarget({ groupId: null, atIndex: i + 1 });
                      setMenuOpen(true);
                    }}
                    onDelete={() => setDeleteTarget({ node, groupId: null })}
                    onAddChild={() => {
                      setMenuTarget({ groupId: node.id, atIndex: node.children.length });
                      setMenuOpen(true);
                    }}
                    childActions={(child, idx) => childActions(node, child, idx)}
                    onChildDragEnd={onGroupDragEnd(node.id)}
                    sensors={sensors}
                  />
                ) : (
                  <BlockCard
                    key={node.id}
                    block={node}
                    grid
                    selected={selectedId === node.id}
                    onSelect={() => setSelectedId(node.id)}
                    onEdit={() => {
                      setSelectedId(node.id);
                      setEditing({ kind: "block", block: node, groupId: null });
                    }}
                    onDuplicate={() => duplicateTop(node)}
                    onInsertAfter={() => {
                      setMenuTarget({ groupId: null, atIndex: i + 1 });
                      setMenuOpen(true);
                    }}
                    onDelete={() => setDeleteTarget({ node, groupId: null })}
                  />
                ),
              )}
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
                    onSelect={() => pick(b.type)}
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
            {showGroupOption && (
              <CommandGroup heading="Layout">
                <CommandItem
                  value={`${GROUP_META.label} ${GROUP_META.description}`}
                  onSelect={() => pick("GROUP")}
                >
                  <DynamicIcon name={GROUP_META.icon} className="size-4" />
                  <div className="flex flex-col">
                    <span>{GROUP_META.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {GROUP_META.description}
                    </span>
                  </div>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>

      <BlockEditorSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        target={editorTarget}
        connections={connections}
        resources={resources}
        groupSource={editorGroupSource}
        onSave={applyDraft}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this {deleteTarget && isGroup(deleteTarget.node) ? "group" : "block"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && isGroup(deleteTarget.node)
                ? "The group and the blocks inside it will be removed. The external API data is not touched."
                : "It will be removed from the page. The external API data is not touched."}
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
