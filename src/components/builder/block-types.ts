import type { BlockDataSource, BlockDef } from "@/types/meta";
import type { BlockType } from "@prisma/client";

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

/** A fresh draft block of the given type (no id yet). */
export function defaultBlockDraft(
  type: BlockType,
): Omit<BlockDef, "id"> {
  switch (type) {
    case "TABLE":
      return {
        type,
        width: "full",
        config: { title: "" },
        dataSource: { mode: "resource", resourceId: "" },
        visibleToRoles: null,
      };
    case "CHART":
      return {
        type,
        width: "full",
        config: {
          title: "",
          chartType: "bar",
          xPath: "",
          series: [{ label: "Value", yPath: "", color: "" }],
        },
        dataSource: { ...RAW_SOURCE },
        visibleToRoles: null,
      };
    case "STAT":
      return {
        type,
        width: "full",
        config: {
          title: "",
          columns: 3,
          metrics: [{ label: "Total", valuePath: "", aggregate: "count" }],
        },
        dataSource: { ...RAW_SOURCE },
        visibleToRoles: null,
      };
    case "BUTTON":
      return {
        type,
        width: "third",
        config: { label: "Run action", variant: "default" },
        dataSource: { ...RAW_SOURCE, method: "POST" },
        visibleToRoles: null,
      };
    case "HEADING":
      return {
        type,
        width: "full",
        config: { text: "Section title", level: 2 },
        dataSource: null,
        visibleToRoles: null,
      };
    case "TEXT":
      return {
        type,
        width: "full",
        config: { markdown: "" },
        dataSource: null,
        visibleToRoles: null,
      };
    case "DIVIDER":
      return { type, width: "full", config: null, dataSource: null, visibleToRoles: null };
    case "CALLOUT":
      return {
        type,
        width: "full",
        config: { text: "", tone: "info" },
        dataSource: null,
        visibleToRoles: null,
      };
    default:
      return { type, width: "full", config: null, dataSource: null, visibleToRoles: null };
  }
}

/** A short human summary of a block for the builder list. */
export function blockSummary(block: BlockDef): string {
  const cfg = block.config as Record<string, unknown> | null;
  switch (block.type) {
    case "TABLE":
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
