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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DynamicIcon } from "@/lib/icons";
import { ROLES } from "@/lib/roles";
import {
  deleteMenuItem,
  reorderMenu,
  saveMenuItem,
  type MenuItemInput,
} from "@/server/actions/menu";
import type { MenuItemType, Role } from "@prisma/client";

interface ItemRow {
  id: string;
  label: string;
  icon: string | null;
  type: MenuItemType;
  resourceId: string | null;
  pageId: string | null;
  href: string | null;
  parentId: string | null;
  order: number;
  visibleToRoles: Role[];
}

const TYPE_LABELS: Record<MenuItemType, string> = {
  GROUP: "Group",
  RESOURCE: "Resource link",
  PAGE: "Page link",
  LINK: "Custom link",
  DIVIDER: "Divider",
};

function SortableRow({
  item,
  depth,
  onEdit,
  onDelete,
}: {
  item: ItemRow;
  depth: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        marginLeft: depth * 24,
      }}
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
      <DynamicIcon name={item.icon} className="size-4 text-muted-foreground" />
      <span className="font-medium">
        {item.type === "DIVIDER" ? "————" : item.label}
      </span>
      <Badge variant="secondary" className="text-[10px]">
        {TYPE_LABELS[item.type]}
      </Badge>
      {item.visibleToRoles.length > 0 && (
        <Badge variant="outline" className="text-[10px]">
          {item.visibleToRoles.join(", ")}
        </Badge>
      )}
      <div className="ml-auto flex gap-1">
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
    </div>
  );
}

const EMPTY: MenuItemInput = {
  label: "",
  icon: "",
  type: "RESOURCE",
  resourceId: "",
  pageId: "",
  href: "",
  parentId: null,
  visibleToRoles: [],
};

export function MenuBuilderClient({
  items,
  resources,
  pages,
  onRefresh,
}: {
  items: ItemRow[];
  resources: { id: string; name: string }[];
  pages: { id: string; name: string }[];
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<MenuItemInput>(EMPTY);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const roots = items
    .filter((i) => !i.parentId)
    .sort((a, b) => a.order - b.order);
  const childrenOf = (id: string) =>
    items.filter((i) => i.parentId === id).sort((a, b) => a.order - b.order);
  const groups = items.filter((i) => i.type === "GROUP");

  function persistOrder(parentId: string | null, orderedIds: string[]) {
    startTransition(async () => {
      const result = await reorderMenu([{ parentId, orderedIds }]);
      if (!result.ok) toast.error(result.error);
      router.refresh();
      onRefresh?.();
    });
  }

  function makeDragEnd(parentId: string | null, list: ItemRow[]) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = list.findIndex((i) => i.id === active.id);
      const newIndex = list.findIndex((i) => i.id === over.id);
      persistOrder(
        parentId,
        arrayMove(list, oldIndex, newIndex).map((i) => i.id),
      );
    };
  }

  function openEdit(item: ItemRow) {
    setDraft({
      id: item.id,
      label: item.label,
      icon: item.icon ?? "",
      type: item.type,
      resourceId: item.resourceId ?? "",
      pageId: item.pageId ?? "",
      href: item.href ?? "",
      parentId: item.parentId,
      visibleToRoles: item.visibleToRoles,
    });
    setDialogOpen(true);
  }

  function set<K extends keyof MenuItemInput>(key: K, value: MenuItemInput[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const result = await saveMenuItem(draft);
      if (result.ok) {
        toast.success(draft.id ? "Menu item saved" : "Menu item added");
        setDialogOpen(false);
        router.refresh();
        onRefresh?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteMenuItem(id);
      if (result.ok) {
        toast.success("Menu item deleted");
        router.refresh();
        onRefresh?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  function renderList(parentId: string | null, list: ItemRow[], depth: number) {
    return (
      <DndContext
        // Stable id keeps dnd-kit's generated `aria-describedby` identical on
        // server and client (otherwise its internal counter mismatches and
        // React reports a hydration error).
        id={`menu-dnd-${parentId ?? "root"}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={makeDragEnd(parentId, list)}
      >
        <SortableContext
          items={list.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {list.map((item) => (
              <div key={item.id} className="space-y-2">
                <SortableRow
                  item={item}
                  depth={depth}
                  onEdit={() => openEdit(item)}
                  onDelete={() => remove(item.id)}
                />
                {item.type === "GROUP" &&
                  renderList(item.id, childrenOf(item.id), depth + 1)}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setDraft(EMPTY);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" /> Add menu item
        </Button>
      </div>

      {roots.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          The menu is empty.
        </div>
      ) : (
        renderList(null, roots, 0)
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {draft.id ? "Edit menu item" : "Add menu item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={draft.type}
                  onValueChange={(v) => set("type", v as MenuItemType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS)
                      // RESOURCE links are legacy; new items link Pages instead.
                      .filter(([value]) => value !== "RESOURCE")
                      .map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={draft.label}
                  onChange={(e) => set("label", e.target.value)}
                  disabled={draft.type === "DIVIDER"}
                  placeholder={draft.type === "DIVIDER" ? "—" : "Products"}
                />
              </div>
            </div>

            {draft.type === "RESOURCE" && (
              <div className="space-y-2">
                <Label>Resource</Label>
                <Select
                  value={draft.resourceId || ""}
                  onValueChange={(v) => set("resourceId", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a resource" />
                  </SelectTrigger>
                  <SelectContent>
                    {resources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {draft.type === "PAGE" && (
              <div className="space-y-2">
                <Label>Page</Label>
                <Select
                  value={draft.pageId || ""}
                  onValueChange={(v) => set("pageId", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {draft.type === "LINK" && (
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={draft.href ?? ""}
                  onChange={(e) => set("href", e.target.value)}
                  placeholder="/dashboard or https://…"
                />
              </div>
            )}

            {draft.type !== "GROUP" && (
              <div className="space-y-2">
                <Label>Group</Label>
                <Select
                  value={draft.parentId ?? "__root"}
                  onValueChange={(v) =>
                    set("parentId", v === "__root" ? null : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root">Top level</SelectItem>
                    {groups
                      .filter((g) => g.id !== draft.id)
                      .map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {draft.type !== "DIVIDER" && (
              <div className="space-y-2">
                <Label>Icon (lucide name)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={draft.icon ?? ""}
                    onChange={(e) => set("icon", e.target.value)}
                    placeholder="package"
                  />
                  <DynamicIcon
                    name={draft.icon}
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Any icon name from lucide.dev, e.g. “shopping-cart”.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Visible to roles</Label>
              <div className="flex flex-wrap gap-3">
                {ROLES.map((role) => {
                  const list = draft.visibleToRoles ?? [];
                  const checked = list.includes(role);
                  return (
                    <label key={role} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          set(
                            "visibleToRoles",
                            v
                              ? [...list, role]
                              : list.filter((r) => r !== role),
                          )
                        }
                      />
                      {role}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave all unchecked to show to everyone.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>{draft.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
