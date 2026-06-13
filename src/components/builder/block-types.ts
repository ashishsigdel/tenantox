import type { BlockDataSource, BlockDef, GroupDef } from "@/types/meta";
import type { BlockType } from "@prisma/client";

/** A palette choice: a leaf block type, or the Group container. */
export type InsertKind = BlockType | "GROUP";

export interface BlockTypeMeta {
  type: BlockType;
  label: string;
  /** lucide icon name (kebab or pascal — DynamicIcon handles both). */
  icon: string;
  group: "Data" | "Action" | "Content";
  description: string;
  /** Whether this block binds to a raw API endpoint. */
  raw: boolean;
}

export const BLOCK_TYPES: BlockTypeMeta[] = [
  {
    type: "TABLE",
    label: "Table / CRUD",
    icon: "Table",
    group: "Data",
    description: "List + create/edit/delete from an existing resource.",
    raw: false,
  },
  {
    type: "CHART",
    label: "Chart",
    icon: "ChartColumn",
    group: "Data",
    description: "Line, bar, area, or pie from an endpoint.",
    raw: true,
  },
  {
    type: "STAT",
    label: "Stat cards",
    icon: "Gauge",
    group: "Data",
    description: "KPI metrics (count, sum, avg, latest).",
    raw: true,
  },
  {
    type: "BUTTON",
    label: "Action button",
    icon: "MousePointerClick",
    group: "Action",
    description: "Calls an endpoint on click, with optional confirm.",
    raw: true,
  },
  {
    type: "HEADING",
    label: "Heading",
    icon: "Heading",
    group: "Content",
    description: "A section title.",
    raw: false,
  },
  {
    type: "TEXT",
    label: "Text",
    icon: "Text",
    group: "Content",
    description: "Markdown paragraph, list, or notes.",
    raw: false,
  },
  {
    type: "DIVIDER",
    label: "Divider",
    icon: "Minus",
    group: "Content",
    description: "A horizontal rule.",
    raw: false,
  },
  {
    type: "CALLOUT",
    label: "Callout",
    icon: "Info",
    group: "Content",
    description: "A highlighted note or banner.",
    raw: false,
  },
];

/** Palette metadata for the Group container (not a BlockType). */
export const GROUP_META = {
  label: "Group",
  icon: "LayoutGrid",
  group: "Layout" as const,
  description: "One API call shared by the blocks inside it.",
};

export function blockTypeMeta(type: BlockType): BlockTypeMeta {
  return BLOCK_TYPES.find((b) => b.type === type) ?? BLOCK_TYPES[0];
}

const RAW_SOURCE: Extract<BlockDataSource, { mode: "raw" }> = {
  mode: "raw",
  connectionId: "",
  method: "GET",
  path: "",
  rootPath: "",
};

const GROUP_SOURCE: Extract<BlockDataSource, { mode: "group" }> = {
  mode: "group",
  rootPath: "",
};

/**
 * A fresh draft block of the given type (no id yet). When `inGroup`, data
 * blocks bind to the enclosing group's response (a `rootPath`) instead of
 * their own endpoint.
 */
export function defaultBlockDraft(
  type: BlockType,
  inGroup = false,
): Omit<BlockDef, "id"> {
  switch (type) {
    case "TABLE":
      return {
        kind: "block",
        type,
        width: "full",
        config: { title: "" },
        dataSource: inGroup
          ? { ...GROUP_SOURCE }
          : { mode: "resource", resourceId: "" },
        visibleToRoles: null,
      };
    case "CHART":
      return {
        kind: "block",
        type,
        width: "full",
        config: {
          title: "",
          chartType: "bar",
          xPath: "",
          series: [{ label: "Value", yPath: "", color: "" }],
        },
        dataSource: inGroup ? { ...GROUP_SOURCE } : { ...RAW_SOURCE },
        visibleToRoles: null,
      };
    case "STAT":
      return {
        kind: "block",
        type,
        width: "full",
        config: {
          title: "",
          columns: 3,
          metrics: [{ label: "Total", valuePath: "", aggregate: "count" }],
        },
        dataSource: inGroup ? { ...GROUP_SOURCE } : { ...RAW_SOURCE },
        visibleToRoles: null,
      };
    case "BUTTON":
      // A button fires an action; it always uses its own endpoint.
      return {
        kind: "block",
        type,
        width: "third",
        config: { label: "Run action", variant: "default" },
        dataSource: { ...RAW_SOURCE, method: "POST" },
        visibleToRoles: null,
      };
    case "HEADING":
      return {
        kind: "block",
        type,
        width: "full",
        config: { text: "Section title", level: 2 },
        dataSource: null,
        visibleToRoles: null,
      };
    case "TEXT":
      return {
        kind: "block",
        type,
        width: "full",
        config: { markdown: "" },
        dataSource: null,
        visibleToRoles: null,
      };
    case "DIVIDER":
      return {
        kind: "block",
        type,
        width: "full",
        config: null,
        dataSource: null,
        visibleToRoles: null,
      };
    case "CALLOUT":
      return {
        kind: "block",
        type,
        width: "full",
        config: { text: "", tone: "info" },
        dataSource: null,
        visibleToRoles: null,
      };
    default:
      return {
        kind: "block",
        type,
        width: "full",
        config: null,
        dataSource: null,
        visibleToRoles: null,
      };
  }
}

/** A fresh draft group (no id yet). */
export function defaultGroupDraft(): Omit<GroupDef, "id"> {
  return {
    kind: "group",
    width: "full",
    config: { title: "", columns: 2 },
    source: { connectionId: "", method: "GET", path: "" },
    children: [],
    visibleToRoles: null,
  };
}

/** A short human summary of a block for the builder list. */
export function blockSummary(block: BlockDef): string {
  const cfg = block.config as Record<string, unknown> | null;
  switch (block.type) {
    case "TABLE":
      if (block.dataSource?.mode === "group") return "group table";
      return block.dataSource?.mode === "resource"
        ? "resource table"
        : "unlinked";
    case "CHART":
      return `${(cfg?.chartType as string) ?? "chart"} · ${
        (cfg?.title as string) || "untitled"
      }`;
    case "STAT":
      return `${((cfg?.metrics as unknown[])?.length ?? 0)} metric(s)`;
    case "BUTTON":
      return (cfg?.label as string) || "button";
    case "HEADING":
      return (cfg?.text as string) || "heading";
    case "TEXT":
      return (cfg?.markdown as string)?.slice(0, 40) || "empty text";
    case "CALLOUT":
      return (cfg?.text as string)?.slice(0, 40) || "callout";
    default:
      return "";
  }
}
