"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { JsonHighlight } from "@/components/ui/json-highlight";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROLES } from "@/lib/roles";
import { usePreviewSource } from "@/lib/data-provider";
import type {
  BlockDataSource,
  BlockDef,
  BlockWidth,
  ChartConfig,
  GroupConfig,
  GroupDef,
  GroupSource,
  HttpMethod,
  StatConfig,
} from "@/types/meta";
import type { BlockType, Role } from "@prisma/client";

import { blockTypeMeta, defaultBlockDraft, defaultGroupDraft } from "./block-types";
import { TableSourceEditor } from "./table-source-editor";

type Connection = { id: string; name: string };
type ResourceOption = { id: string; name: string; slug: string };

type BlockDraft = Omit<BlockDef, "id">;
type GroupDraft = Omit<GroupDef, "id">;

/** What the sheet is currently editing. */
export type EditorTarget =
  | { mode: "block"; block: BlockDef | null; newType: BlockType | null; inGroup: boolean }
  | { mode: "group"; group: GroupDef | null };

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function BlockEditorSheet({
  open,
  onOpenChange,
  target,
  connections,
  resources,
  groupSource,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: EditorTarget | null;
  connections: Connection[];
  resources: ResourceOption[];
  /** When editing a block inside a group, that group's source — for the test
   * preview so the author can find the right section path. */
  groupSource: GroupSource | null;
  /** Receives the edited node draft (block or group); the parent owns the tree. */
  onSave: (draft: BlockDraft | GroupDraft) => void;
}) {
  const [blockDraft, setBlockDraft] = useState<BlockDraft>(() =>
    defaultBlockDraft("TEXT"),
  );
  const [groupDraft, setGroupDraft] = useState<GroupDraft>(() =>
    defaultGroupDraft(),
  );
  const preview = usePreviewSource();
  const [previewText, setPreviewText] = useState<string | null>(null);

  const isGroup = target?.mode === "group";
  const inGroup = target?.mode === "block" ? target.inGroup : false;

  useEffect(() => {
    if (!open || !target) return;
    setPreviewText(null);
    if (target.mode === "group") {
      setGroupDraft(
        target.group
          ? {
              kind: "group",
              width: target.group.width,
              config: target.group.config,
              source: target.group.source,
              children: target.group.children,
              visibleToRoles: target.group.visibleToRoles,
            }
          : defaultGroupDraft(),
      );
    } else if (target.block) {
      setBlockDraft({
        kind: "block",
        type: target.block.type,
        width: target.block.width,
        config: target.block.config,
        dataSource: target.block.dataSource,
        visibleToRoles: target.block.visibleToRoles,
      });
    } else if (target.newType) {
      setBlockDraft(defaultBlockDraft(target.newType, target.inGroup));
    }
  }, [open, target]);

  /* ------------------------------- group edit ------------------------------ */

  function setGroupConfig(patch: Partial<GroupConfig>) {
    setGroupDraft((d) => ({ ...d, config: { ...d.config, ...patch } }));
  }
  function setGroupSrc(patch: Partial<GroupSource>) {
    setGroupDraft((d) => ({
      ...d,
      source: { ...(d.source ?? { connectionId: "", method: "GET", path: "" }), ...patch },
    }));
  }

  /* ------------------------------- block edit ------------------------------ */

  const type = blockDraft.type;
  const meta = blockTypeMeta(type);
  const config = (blockDraft.config ?? {}) as Record<string, unknown>;
  const ds = blockDraft.dataSource;

  const showResourcePicker = type === "TABLE" && !inGroup;
  const isGroupChildData =
    inGroup && (type === "CHART" || type === "STAT" || type === "TABLE");
  // Standalone CHART/STAT/BUTTON, plus BUTTON inside a group, use a raw endpoint.
  const showRawEditor = !showResourcePicker && !isGroupChildData && meta.raw;

  const raw =
    ds?.mode === "raw"
      ? (ds as Extract<BlockDataSource, { mode: "raw" }>)
      : null;
  const groupRoot = ds?.mode === "group" ? ds.rootPath ?? "" : "";

  function setConfig(patch: Record<string, unknown>) {
    setBlockDraft((d) => ({ ...d, config: { ...(d.config ?? {}), ...patch } }));
  }
  function setRaw(patch: Partial<Extract<BlockDataSource, { mode: "raw" }>>) {
    setBlockDraft((d) => ({
      ...d,
      dataSource: { ...(d.dataSource as object), mode: "raw", ...patch } as BlockDataSource,
    }));
  }
  function setGroupRoot(rootPath: string) {
    setBlockDraft((d) => ({
      ...d,
      dataSource: { mode: "group", rootPath } as BlockDataSource,
    }));
  }

  function toggleRole(role: Role) {
    if (isGroup) {
      setGroupDraft((d) => ({ ...d, visibleToRoles: nextRoles(d.visibleToRoles, role) }));
    } else {
      setBlockDraft((d) => ({ ...d, visibleToRoles: nextRoles(d.visibleToRoles, role) }));
    }
  }

  function runPreview() {
    // Group child blocks preview the parent group's endpoint; everything else
    // previews its own raw source.
    const src = isGroupChildData
      ? groupSource
      : raw
        ? { connectionId: raw.connectionId, method: raw.method, path: raw.path, query: raw.query }
        : isGroup && groupDraft.source
          ? groupDraft.source
          : null;
    if (!src || !src.connectionId || !src.path) {
      toast.error("Set a connection and path first");
      return;
    }
    preview.mutate(
      { connectionId: src.connectionId, method: src.method, path: src.path, query: src.query },
      {
        onSuccess: (data) =>
          setPreviewText(JSON.stringify(data, null, 2).slice(0, 4000)),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  function submit() {
    if (isGroup) {
      onSave(groupDraft);
    } else {
      onSave({
        kind: "block",
        type,
        width: blockDraft.width,
        config: blockDraft.config,
        dataSource: blockDraft.dataSource ?? null,
        visibleToRoles: blockDraft.visibleToRoles,
      });
    }
    onOpenChange(false);
  }

  const editingExisting =
    target?.mode === "group" ? !!target.group : !!target?.block;
  const titleLabel = isGroup ? "Group" : meta.label;
  const visibleToRoles = isGroup ? groupDraft.visibleToRoles : blockDraft.visibleToRoles;
  const width = isGroup ? groupDraft.width : blockDraft.width;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {editingExisting ? "Edit" : "Add"} {titleLabel}
          </SheetTitle>
          <SheetDescription>
            {isGroup ? "One API call shared by the blocks inside." : meta.description}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4">
          {/* ───────────────────────── group editor ───────────────────────── */}
          {isGroup && (
            <>
              <Field label="Title (optional)">
                <Input
                  value={groupDraft.config.title ?? ""}
                  onChange={(e) => setGroupConfig({ title: e.target.value })}
                />
              </Field>
              <Field label="Columns">
                <Select
                  value={String(groupDraft.config.columns ?? 2)}
                  onValueChange={(v) =>
                    setGroupConfig({ columns: Number(v) as GroupConfig["columns"] })
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 6].map((c) => (
                      <SelectItem key={c} value={String(c)}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Shared data source</p>
                <Field label="Connection">
                  <Select
                    value={groupDraft.source?.connectionId ?? ""}
                    onValueChange={(v) => setGroupSrc({ connectionId: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick a connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex gap-2">
                  <Select
                    value={groupDraft.source?.method ?? "GET"}
                    onValueChange={(v) => setGroupSrc({ method: v as HttpMethod })}
                  >
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 font-mono text-xs"
                    value={groupDraft.source?.path ?? ""}
                    onChange={(e) => setGroupSrc({ path: e.target.value })}
                    placeholder="/dashboard"
                  />
                </div>
                <QueryParamsEditor
                  query={groupDraft.source?.query ?? {}}
                  onChange={(query) => setGroupSrc({ query })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={runPreview}
                  disabled={
                    preview.isPending ||
                    !groupDraft.source?.connectionId ||
                    !groupDraft.source?.path
                  }
                >
                  {preview.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Test
                </Button>
                {previewText !== null && <JsonHighlight raw={previewText} />}
              </div>
            </>
          )}

          {/* ───────────────────────── block editor ───────────────────────── */}
          {!isGroup && (
            <>
              {showResourcePicker && (
                <TableSourceEditor
                  value={ds?.mode === "resource" ? ds.resourceId : ""}
                  onChange={(resourceId) =>
                    setBlockDraft((d) => ({
                      ...d,
                      dataSource: { mode: "resource", resourceId },
                    }))
                  }
                  connections={connections}
                  resources={resources}
                />
              )}

              {type === "HEADING" && (
                <>
                  <Field label="Text">
                    <Input
                      value={(config.text as string) ?? ""}
                      onChange={(e) => setConfig({ text: e.target.value })}
                    />
                  </Field>
                  <Field label="Level">
                    <Select
                      value={String(config.level ?? 2)}
                      onValueChange={(v) => setConfig({ level: Number(v) })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">H1</SelectItem>
                        <SelectItem value="2">H2</SelectItem>
                        <SelectItem value="3">H3</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}

              {type === "TEXT" && (
                <Field label="Markdown">
                  <Textarea
                    value={(config.markdown as string) ?? ""}
                    onChange={(e) => setConfig({ markdown: e.target.value })}
                    rows={6}
                    placeholder={"## Heading\n\nSome **bold** text and a\n- bullet\n- list"}
                  />
                </Field>
              )}

              {type === "CALLOUT" && (
                <>
                  <Field label="Text">
                    <Textarea
                      value={(config.text as string) ?? ""}
                      onChange={(e) => setConfig({ text: e.target.value })}
                      rows={3}
                    />
                  </Field>
                  <Field label="Tone">
                    <Select
                      value={(config.tone as string) ?? "info"}
                      onValueChange={(v) => setConfig({ tone: v })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["info", "success", "warning", "danger"].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Icon (lucide, optional)">
                    <Input
                      value={(config.icon as string) ?? ""}
                      onChange={(e) => setConfig({ icon: e.target.value })}
                      placeholder="info"
                    />
                  </Field>
                </>
              )}

              {/* Group child: pick a slice of the group's response. */}
              {isGroupChildData && (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-medium">Data from group</p>
                  <p className="text-xs text-muted-foreground">
                    This block reads a section of the group&apos;s single API
                    response.
                  </p>
                  <Field label="Section path">
                    <Input
                      className="font-mono text-xs"
                      value={groupRoot}
                      onChange={(e) => setGroupRoot(e.target.value)}
                      placeholder="data.stats"
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={runPreview}
                    disabled={preview.isPending || !groupSource}
                  >
                    {preview.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Test group source
                  </Button>
                  {previewText !== null && <JsonHighlight raw={previewText} />}
                </div>
              )}

              {/* Standalone raw endpoint (chart / stat / button). */}
              {showRawEditor && raw && (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-medium">Data source</p>
                  <Field label="Connection">
                    <Select
                      value={raw.connectionId}
                      onValueChange={(v) => setRaw({ connectionId: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick a connection" />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="flex gap-2">
                    <Select
                      value={raw.method}
                      onValueChange={(v) => setRaw({ method: v as HttpMethod })}
                    >
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8 font-mono text-xs"
                      value={raw.path}
                      onChange={(e) => setRaw({ path: e.target.value })}
                      placeholder="/analytics/revenue"
                    />
                  </div>
                  {type !== "BUTTON" && (
                    <Field label="Root path (to the array/object)">
                      <Input
                        className="font-mono text-xs"
                        value={raw.rootPath ?? ""}
                        onChange={(e) => setRaw({ rootPath: e.target.value })}
                        placeholder="data.items"
                      />
                    </Field>
                  )}
                  <QueryParamsEditor
                    query={raw.query ?? {}}
                    onChange={(query) => setRaw({ query })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={runPreview}
                    disabled={preview.isPending || !raw.connectionId || !raw.path}
                  >
                    {preview.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Test
                  </Button>
                  {previewText !== null && <JsonHighlight raw={previewText} />}
                </div>
              )}

              {type === "CHART" && (
                <ChartConfigEditor
                  config={config as unknown as ChartConfig}
                  setConfig={setConfig}
                />
              )}

              {type === "STAT" && (
                <StatConfigEditor
                  config={config as unknown as StatConfig}
                  setConfig={setConfig}
                />
              )}

              {type === "BUTTON" && (
                <>
                  <Field label="Button label">
                    <Input
                      value={(config.label as string) ?? ""}
                      onChange={(e) => setConfig({ label: e.target.value })}
                    />
                  </Field>
                  <Field label="Style">
                    <Select
                      value={(config.variant as string) ?? "default"}
                      onValueChange={(v) => setConfig({ variant: v })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["default", "secondary", "destructive", "outline"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Confirm message (optional)">
                    <Input
                      value={(config.confirm as string) ?? ""}
                      onChange={(e) =>
                        setConfig({ confirm: e.target.value || undefined })
                      }
                      placeholder="This cannot be undone."
                    />
                  </Field>
                  <Field label="Success message (optional)">
                    <Input
                      value={(config.successMessage as string) ?? ""}
                      onChange={(e) =>
                        setConfig({ successMessage: e.target.value || undefined })
                      }
                    />
                  </Field>
                </>
              )}
            </>
          )}

          {/* Common: width + visibility */}
          {!(type === "DIVIDER" && !isGroup) && (
            <Field label="Width">
              <Select
                value={width}
                onValueChange={(v) => {
                  if (isGroup) setGroupDraft((d) => ({ ...d, width: v as BlockWidth }));
                  else setBlockDraft((d) => ({ ...d, width: v as BlockWidth }));
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="half">Half</SelectItem>
                  <SelectItem value="third">Third</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Visible to roles (none = inherit page)">
            <div className="flex flex-wrap gap-3">
              {ROLES.map((role) => (
                <label key={role} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={visibleToRoles?.includes(role) ?? false}
                    onChange={() => toggleRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
          </Field>
        </div>

        <SheetFooter>
          <Button onClick={submit}>
            {editingExisting ? "Save" : "Add"} {isGroup ? "group" : "block"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function nextRoles(current: Role[] | null, role: Role): Role[] | null {
  const list = current ?? [];
  const next = list.includes(role)
    ? list.filter((r) => r !== role)
    : [...list, role];
  return next.length ? next : null;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Editable key/value list for a raw source's static query params. */
function QueryParamsEditor({
  query,
  onChange,
}: {
  query: Record<string, string>;
  onChange: (next: Record<string, string> | undefined) => void;
}) {
  const entries = Object.entries(query);

  function setEntry(index: number, key: string, value: string) {
    const next = entries.map((e, i) => (i === index ? [key, value] : e));
    onChange(Object.fromEntries(next.filter(([k]) => k !== "")));
  }
  function add() {
    onChange({ ...query, "": "" });
  }
  function remove(index: number) {
    const next = entries.filter((_, i) => i !== index);
    const obj = Object.fromEntries(next);
    onChange(Object.keys(obj).length ? obj : undefined);
  }

  return (
    <Field label="Query params (optional)">
      <div className="space-y-2">
        {entries.map(([k, v], i) => (
          <div key={i} className="flex gap-2">
            <Input
              className="h-8 font-mono text-xs"
              value={k}
              onChange={(e) => setEntry(i, e.target.value, v)}
              placeholder="key"
            />
            <Input
              className="h-8 font-mono text-xs"
              value={v}
              onChange={(e) => setEntry(i, k, e.target.value)}
              placeholder="value or {{var}}"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              onClick={() => remove(i)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" /> Add param
        </Button>
      </div>
    </Field>
  );
}

function ChartConfigEditor({
  config,
  setConfig,
}: {
  config: ChartConfig;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  const series = config.series ?? [];
  const update = (i: number, patch: Partial<(typeof series)[number]>) =>
    setConfig({ series: series.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Chart</p>
      <Field label="Title (optional)">
        <Input
          value={config.title ?? ""}
          onChange={(e) => setConfig({ title: e.target.value })}
        />
      </Field>
      <div className="flex gap-3">
        <Field label="Type">
          <Select
            value={config.chartType ?? "bar"}
            onValueChange={(v) => setConfig({ chartType: v })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["line", "bar", "area", "pie", "donut"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="X path (per row)">
          <Input
            className="font-mono text-xs"
            value={config.xPath ?? ""}
            onChange={(e) => setConfig({ xPath: e.target.value })}
            placeholder="month"
          />
        </Field>
      </div>
      <div className="space-y-2">
        <Label>Series</Label>
        {series.map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input
              className="h-8"
              value={s.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label"
            />
            <Input
              className="h-8 font-mono text-xs"
              value={s.yPath}
              onChange={(e) => update(i, { yPath: e.target.value })}
              placeholder="value path"
            />
            <input
              type="color"
              aria-label="Series color"
              className="h-8 w-9 shrink-0 cursor-pointer rounded border bg-background p-0.5"
              value={s.color || "#6366f1"}
              onChange={(e) => update(i, { color: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              onClick={() =>
                setConfig({ series: series.filter((_, j) => j !== i) })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setConfig({ series: [...series, { label: "", yPath: "", color: "" }] })
          }
        >
          <Plus className="size-4" /> Add series
        </Button>
      </div>
    </div>
  );
}

function StatConfigEditor({
  config,
  setConfig,
}: {
  config: StatConfig;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  const metrics = config.metrics ?? [];
  const update = (i: number, patch: Partial<(typeof metrics)[number]>) =>
    setConfig({
      metrics: metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Metrics</p>
      <div className="flex gap-4">
        <Field label="Title (optional)">
          <Input
            value={config.title ?? ""}
            onChange={(e) => setConfig({ title: e.target.value })}
          />
        </Field>
        <Field label="Columns per row">
          <Select
            value={String(config.columns ?? 3)}
            onValueChange={(v) => setConfig({ columns: Number(v) })}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      {metrics.map((m, i) => (
        <div key={i} className="space-y-2 rounded border p-2">
          <div className="flex gap-2">
            <Input
              className="h-8"
              value={m.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              onClick={() =>
                setConfig({ metrics: metrics.filter((_, j) => j !== i) })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Select
              value={m.aggregate}
              onValueChange={(v) =>
                update(i, { aggregate: v as (typeof metrics)[number]["aggregate"] })
              }
            >
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["raw", "count", "sum", "avg", "min", "max"].map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-8 font-mono text-xs"
              value={m.valuePath}
              onChange={(e) => update(i, { valuePath: e.target.value })}
              placeholder="value path"
              disabled={m.aggregate === "count"}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={m.format ?? "text"}
              onValueChange={(v) =>
                update(i, { format: v as (typeof metrics)[number]["format"] })
              }
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue placeholder="format" />
              </SelectTrigger>
              <SelectContent>
                {["text", "currency", "date", "datetime"].map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-8"
              value={m.icon ?? ""}
              onChange={(e) => update(i, { icon: e.target.value || undefined })}
              placeholder="icon (lucide, optional)"
            />
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setConfig({
            metrics: [...metrics, { label: "", valuePath: "", aggregate: "count" }],
          })
        }
      >
        <Plus className="size-4" /> Add metric
      </Button>
    </div>
  );
}
