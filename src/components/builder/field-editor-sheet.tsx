"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { saveField, type FieldInput } from "@/server/actions/resources";
import type {
  CellFormat,
  FieldDef,
  SelectOption,
  VisibleIfOperator,
} from "@/types/meta";
import type { FieldType } from "@prisma/client";

const FIELD_TYPES: FieldType[] = [
  "TEXT", "TEXTAREA", "RICH_TEXT", "NUMBER", "BOOLEAN", "DATE", "DATETIME",
  "SELECT", "MULTI_SELECT", "RADIO", "EMAIL", "URL", "PASSWORD", "FILE",
  "IMAGE", "JSON", "RELATION", "COLOR", "SLUG",
];

const FORMATS: CellFormat[] = [
  "text", "badge", "date", "datetime", "currency", "boolean-icon",
  "image-thumb", "truncate", "link",
];

const BADGE_COLORS = ["green", "yellow", "red", "blue", "purple", "orange", "gray"];

const OPTION_TYPES: FieldType[] = ["SELECT", "MULTI_SELECT", "RADIO"];

interface DraftState {
  key: string;
  label: string;
  type: FieldType;
  placeholder: string;
  helpText: string;
  defaultValue: string;
  width: "full" | "half" | "third";
  readOnly: boolean;
  showInForm: boolean;
  required: boolean;
  minLength: string;
  maxLength: string;
  pattern: string;
  min: string;
  max: string;
  options: SelectOption[];
  relationSlug: string;
  relationValueField: string;
  relationLabelField: string;
  visibleIfField: string;
  visibleIfOperator: VisibleIfOperator | "";
  visibleIfValue: string;
  showInTable: boolean;
  sortable: boolean;
  filterable: boolean;
  format: CellFormat;
  badgeColorMap: Record<string, string>;
}

function emptyDraft(): DraftState {
  return {
    key: "",
    label: "",
    type: "TEXT",
    placeholder: "",
    helpText: "",
    defaultValue: "",
    width: "full",
    readOnly: false,
    showInForm: true,
    required: false,
    minLength: "",
    maxLength: "",
    pattern: "",
    min: "",
    max: "",
    options: [],
    relationSlug: "",
    relationValueField: "id",
    relationLabelField: "name",
    visibleIfField: "",
    visibleIfOperator: "",
    visibleIfValue: "",
    showInTable: true,
    sortable: false,
    filterable: false,
    format: "text",
    badgeColorMap: {},
  };
}

function draftFromField(field: FieldDef): DraftState {
  const relation = field.config?.relation ?? field.config?.optionsSource;
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    placeholder: field.placeholder ?? "",
    helpText: field.helpText ?? "",
    defaultValue: field.defaultValue ?? "",
    width: field.width,
    readOnly: field.readOnly,
    showInForm: field.showInForm,
    required: field.validation?.required ?? false,
    minLength: field.validation?.minLength?.toString() ?? "",
    maxLength: field.validation?.maxLength?.toString() ?? "",
    pattern: field.validation?.pattern ?? "",
    min: (field.validation?.min ?? field.config?.min)?.toString() ?? "",
    max: (field.validation?.max ?? field.config?.max)?.toString() ?? "",
    options: field.config?.options ?? [],
    relationSlug: relation?.resourceSlug ?? "",
    relationValueField: relation?.valueField ?? "id",
    relationLabelField: relation?.labelField ?? "name",
    visibleIfField: field.visibleIf?.field ?? "",
    visibleIfOperator: field.visibleIf?.operator ?? "",
    visibleIfValue:
      field.visibleIf?.value != null ? String(field.visibleIf.value) : "",
    showInTable: field.showInTable,
    sortable: field.sortable,
    filterable: field.filterable,
    format: field.format,
    badgeColorMap: field.badgeColorMap ?? {},
  };
}

function toFieldInput(
  draft: DraftState,
  resourceId: string,
  fieldId?: string,
): FieldInput {
  const config: Record<string, unknown> = {};
  if (OPTION_TYPES.includes(draft.type) && draft.options.length > 0) {
    config.options = draft.options;
  }
  if (draft.type === "RELATION" && draft.relationSlug) {
    config.relation = {
      resourceSlug: draft.relationSlug,
      valueField: draft.relationValueField || "id",
      labelField: draft.relationLabelField || "name",
    };
  }
  if (OPTION_TYPES.includes(draft.type) && draft.options.length === 0 && draft.relationSlug) {
    config.optionsSource = {
      resourceSlug: draft.relationSlug,
      valueField: draft.relationValueField || "id",
      labelField: draft.relationLabelField || "name",
    };
  }
  if (draft.type === "NUMBER") {
    if (draft.min !== "") config.min = Number(draft.min);
    if (draft.max !== "") config.max = Number(draft.max);
  }

  const validation: Record<string, unknown> = {};
  if (draft.required) validation.required = true;
  if (draft.minLength !== "") validation.minLength = Number(draft.minLength);
  if (draft.maxLength !== "") validation.maxLength = Number(draft.maxLength);
  if (draft.pattern) validation.pattern = draft.pattern;
  if (draft.type === "NUMBER") {
    if (draft.min !== "") validation.min = Number(draft.min);
    if (draft.max !== "") validation.max = Number(draft.max);
  }

  const visibleIf =
    draft.visibleIfField && draft.visibleIfOperator
      ? {
          field: draft.visibleIfField,
          operator: draft.visibleIfOperator,
          ...(draft.visibleIfOperator !== "truthy" && {
            value: draft.visibleIfValue,
          }),
        }
      : null;

  return {
    id: fieldId,
    resourceId,
    key: draft.key,
    label: draft.label,
    type: draft.type,
    config: Object.keys(config).length > 0 ? config : null,
    validation: Object.keys(validation).length > 0 ? validation : null,
    showInForm: draft.showInForm,
    placeholder: draft.placeholder,
    helpText: draft.helpText,
    defaultValue: draft.defaultValue,
    readOnly: draft.readOnly,
    width: draft.width,
    visibleIf,
    showInTable: draft.showInTable,
    sortable: draft.sortable,
    filterable: draft.filterable,
    format: draft.format,
    badgeColorMap:
      draft.format === "badge" && Object.keys(draft.badgeColorMap).length > 0
        ? draft.badgeColorMap
        : null,
  };
}

export function FieldEditorSheet({
  open,
  onOpenChange,
  resourceId,
  field,
  existingKeys,
  resourceOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  /** null = creating a new field. */
  field: FieldDef | null;
  existingKeys: string[];
  resourceOptions: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DraftState>(emptyDraft());

  useEffect(() => {
    if (open) setDraft(field ? draftFromField(field) : emptyDraft());
  }, [open, field]);

  function set<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const result = await saveField(toFieldInput(draft, resourceId, field?.id));
      if (result.ok) {
        toast.success(field ? "Field saved" : "Field added");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const showOptions = OPTION_TYPES.includes(draft.type);
  const showRelation = draft.type === "RELATION";
  const otherKeys = existingKeys.filter((k) => k !== field?.key);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{field ? `Edit field: ${field.label}` : "Add field"}</SheetTitle>
          <SheetDescription>
            One definition drives both the form input and the table column.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={draft.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setDraft((d) => ({
                    ...d,
                    label,
                    // Auto-derive the key while creating.
                    ...(field === null && {
                      key: label
                        .replace(/[^a-zA-Z0-9 ]/g, "")
                        .trim()
                        .split(/\s+/)
                        .map((w, i) =>
                          i === 0
                            ? w.toLowerCase()
                            : w[0]?.toUpperCase() + w.slice(1).toLowerCase(),
                        )
                        .join(""),
                    }),
                  }));
                }}
                placeholder="Price"
              />
            </div>
            <div className="space-y-2">
              <Label>Key (API property)</Label>
              <Input
                value={draft.key}
                onChange={(e) => set("key", e.target.value)}
                placeholder="price"
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={draft.type}
                onValueChange={(v) => set("type", v as FieldType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Form width</Label>
              <Select
                value={draft.width}
                onValueChange={(v) => set("width", v as DraftState["width"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full row</SelectItem>
                  <SelectItem value="half">Half</SelectItem>
                  <SelectItem value="third">Third</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input
                value={draft.placeholder}
                onChange={(e) => set("placeholder", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Default value</Label>
              <Input
                value={draft.defaultValue}
                onChange={(e) => set("defaultValue", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Help text</Label>
            <Input
              value={draft.helpText}
              onChange={(e) => set("helpText", e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.showInForm}
                onCheckedChange={(v) => set("showInForm", v)}
              />
              Show in form
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.readOnly}
                onCheckedChange={(v) => set("readOnly", v)}
              />
              Read-only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.required}
                onCheckedChange={(v) => set("required", v)}
              />
              Required
            </label>
          </div>

          {/* Options for SELECT-likes */}
          {showOptions && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      set("options", [...draft.options, { label: "", value: "" }])
                    }
                  >
                    <Plus className="size-3.5" /> Add option
                  </Button>
                </div>
                {draft.options.map((option, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Label"
                      className="h-8"
                      value={option.label}
                      onChange={(e) => {
                        const next = [...draft.options];
                        next[i] = { ...option, label: e.target.value };
                        set("options", next);
                      }}
                    />
                    <Input
                      placeholder="value"
                      className="h-8 font-mono text-xs"
                      value={option.value}
                      onChange={(e) => {
                        const next = [...draft.options];
                        next[i] = { ...option, value: e.target.value };
                        set("options", next);
                      }}
                    />
                    {draft.format === "badge" && (
                      <Select
                        value={draft.badgeColorMap[option.value] ?? ""}
                        onValueChange={(color) =>
                          set("badgeColorMap", {
                            ...draft.badgeColorMap,
                            [option.value]: color,
                          })
                        }
                      >
                        <SelectTrigger size="sm" className="w-28">
                          <SelectValue placeholder="color" />
                        </SelectTrigger>
                        <SelectContent>
                          {BADGE_COLORS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() =>
                        set(
                          "options",
                          draft.options.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Leave options empty and pick a resource below to load options
                  dynamically from another resource.
                </p>
              </div>
            </>
          )}

          {/* Relation / dynamic options source */}
          {(showRelation || showOptions) && (
            <div className="space-y-2">
              <Label>
                {showRelation ? "Related resource" : "Dynamic options source"}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={draft.relationSlug || "__none"}
                  onValueChange={(v) =>
                    set("relationSlug", v === "__none" ? "" : v)
                  }
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Resource" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {resourceOptions.map((r) => (
                      <SelectItem key={r.slug} value={r.slug}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="value field"
                  className="h-8 font-mono text-xs"
                  value={draft.relationValueField}
                  onChange={(e) => set("relationValueField", e.target.value)}
                />
                <Input
                  placeholder="label field"
                  className="h-8 font-mono text-xs"
                  value={draft.relationLabelField}
                  onChange={(e) => set("relationLabelField", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Validation */}
          <Separator />
          <div className="space-y-2">
            <Label>Validation</Label>
            {draft.type === "NUMBER" ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Min"
                  className="h-8"
                  value={draft.min}
                  onChange={(e) => set("min", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  className="h-8"
                  value={draft.max}
                  onChange={(e) => set("max", e.target.value)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <Input
                  type="number"
                  placeholder="Min length"
                  className="h-8"
                  value={draft.minLength}
                  onChange={(e) => set("minLength", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max length"
                  className="h-8"
                  value={draft.maxLength}
                  onChange={(e) => set("maxLength", e.target.value)}
                />
                <Input
                  placeholder="Regex pattern"
                  className="h-8 font-mono text-xs"
                  value={draft.pattern}
                  onChange={(e) => set("pattern", e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Conditional visibility */}
          <div className="space-y-2">
            <Label>Show only when… (optional)</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select
                value={draft.visibleIfField || "__none"}
                onValueChange={(v) =>
                  set("visibleIfField", v === "__none" ? "" : v)
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Always show</SelectItem>
                  {otherKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={draft.visibleIfOperator || "eq"}
                onValueChange={(v) =>
                  set("visibleIfOperator", v as VisibleIfOperator)
                }
                disabled={!draft.visibleIfField}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">equals</SelectItem>
                  <SelectItem value="neq">not equals</SelectItem>
                  <SelectItem value="truthy">is on / true</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Value"
                className="h-8"
                value={draft.visibleIfValue}
                onChange={(e) => set("visibleIfValue", e.target.value)}
                disabled={!draft.visibleIfField || draft.visibleIfOperator === "truthy"}
              />
            </div>
          </div>

          {/* Table settings */}
          <Separator />
          <div className="space-y-3">
            <Label>Table column</Label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.showInTable}
                  onCheckedChange={(v) => set("showInTable", v)}
                />
                Show in table
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.sortable}
                  onCheckedChange={(v) => set("sortable", v)}
                  disabled={!draft.showInTable}
                />
                Sortable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.filterable}
                  onCheckedChange={(v) => set("filterable", v)}
                />
                Filterable
              </label>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Cell format
              </Label>
              <Select
                value={draft.format}
                onValueChange={(v) => set("format", v as CellFormat)}
                disabled={!draft.showInTable}
              >
                <SelectTrigger size="sm" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {field ? "Save field" : "Add field"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
