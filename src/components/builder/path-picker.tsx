"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPath } from "@/lib/json-path";
import { cn } from "@/lib/utils";

/** Object keys you can drill into. Arrays are terminal (you stop at the list);
 * this keeps generated paths valid for `getPath`, which has no index segment
 * in per-row paths. */
function childKeys(node: unknown): string[] {
  return node && typeof node === "object" && !Array.isArray(node)
    ? Object.keys(node as Record<string, unknown>)
    : [];
}

type Described = { label: string; kind: "array" | "object" | "value" | "missing" };

/** Human-readable summary of what a resolved path points at. */
function describe(node: unknown): Described {
  if (node === undefined) return { label: "not found", kind: "missing" };
  if (Array.isArray(node))
    return { label: `array · ${node.length} item${node.length === 1 ? "" : "s"}`, kind: "array" };
  if (node === null) return { label: "null", kind: "value" };
  if (typeof node === "object")
    return {
      label: `object · ${Object.keys(node as object).length} keys`,
      kind: "object",
    };
  if (typeof node === "string")
    return { label: `text · "${node.slice(0, 20)}"`, kind: "value" };
  return { label: `${typeof node} · ${String(node)}`, kind: "value" };
}

/**
 * Cascading dropdown that walks a sample JSON value key-by-key and emits a
 * dot-path. Each level lists the keys available at that point, so authors pick
 * a path that actually exists instead of typing one.
 */
export function PathPicker({
  sample,
  value,
  onChange,
  arrayExpected = false,
}: {
  /** The JSON value to walk; the produced path is relative to this. */
  sample: unknown;
  value: string;
  onChange: (path: string) => void;
  /** When true, warn unless the selected path resolves to an array. */
  arrayExpected?: boolean;
}) {
  const segments = value ? value.split(".").filter(Boolean) : [];

  // One select per chosen segment, plus a trailing "add level" select.
  const levels: { selected: string; options: string[] }[] = [];
  for (let i = 0; i < segments.length; i++) {
    const node = getPath(sample, segments.slice(0, i).join("."));
    levels.push({ selected: segments[i], options: childKeys(node) });
  }
  const tailKeys = childKeys(getPath(sample, value));

  const resolved = describe(getPath(sample, value));
  const setSegment = (index: number, key: string) =>
    onChange([...segments.slice(0, index), key].join("."));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {value === "" && (
          <span className="text-xs text-muted-foreground">(root)</span>
        )}
        {levels.map((lvl, i) => (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
            <Select value={lvl.selected} onValueChange={(v) => setSegment(i, v)}>
              <SelectTrigger size="sm" className="h-7 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Keep the current value selectable even if its parent is an
                    array (no drillable keys). */}
                {(lvl.options.length ? lvl.options : [lvl.selected]).map((k) => (
                  <SelectItem key={k} value={k} className="font-mono text-xs">
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Fragment>
        ))}
        {tailKeys.length > 0 && (
          <>
            {levels.length > 0 && (
              <ChevronRight className="size-3 text-muted-foreground" />
            )}
            <Select value="" onValueChange={(v) => onChange([...segments, v].join("."))}>
              <SelectTrigger size="sm" className="h-7 font-mono text-xs text-muted-foreground">
                <SelectValue placeholder={levels.length ? "+ key" : "select…"} />
              </SelectTrigger>
              <SelectContent>
                {tailKeys.map((k) => (
                  <SelectItem key={k} value={k} className="font-mono text-xs">
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      <p
        className={cn(
          "text-xs",
          resolved.kind === "missing"
            ? "text-destructive"
            : arrayExpected && resolved.kind !== "array"
              ? "text-amber-600 dark:text-amber-500"
              : "text-muted-foreground",
        )}
      >
        {value ? (
          <span className="font-mono">{value}</span>
        ) : (
          "whole response"
        )}{" "}
        → {resolved.label}
        {arrayExpected && resolved.kind !== "array" && resolved.kind !== "missing"
          ? " — needs a list (array) to render rows"
          : ""}
      </p>
    </div>
  );
}

/**
 * A path field that prefers the visual {@link PathPicker} once a sample
 * response is available, with a manual text fallback for paths a sample may
 * not show (sparse/optional keys).
 */
export function PathField({
  sample,
  value,
  onChange,
  placeholder,
  arrayExpected,
}: {
  sample: unknown;
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  arrayExpected?: boolean;
}) {
  const [manual, setManual] = useState(false);
  const hasSample = sample !== undefined && sample !== null;

  if (!hasSample || manual) {
    return (
      <div className="space-y-1">
        <Input
          className="font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {hasSample ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setManual(false)}
          >
            Pick from response
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Run <span className="font-medium">Test</span> to pick from the response.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <PathPicker
        sample={sample}
        value={value}
        onChange={onChange}
        arrayExpected={arrayExpected}
      />
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setManual(true)}
      >
        Edit manually
      </button>
    </div>
  );
}
