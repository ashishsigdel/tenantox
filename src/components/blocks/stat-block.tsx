"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicIcon } from "@/lib/icons";
import { useBlockData } from "@/lib/data-provider";
import { getArray, getPath, toNumber } from "@/lib/json-path";
import type { BlockDef, CellFormat, StatConfig, StatMetric } from "@/types/meta";

/** Formats an aggregated stat value for display. */
function formatValue(value: unknown, format: CellFormat): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (format) {
    case "currency": {
      const n = toNumber(value);
      return n === null
        ? String(value)
        : n.toLocaleString(undefined, { style: "currency", currency: "USD" });
    }
    case "date":
      return new Date(String(value)).toLocaleDateString();
    case "datetime":
      return new Date(String(value)).toLocaleString();
    default: {
      const n = toNumber(value);
      return n === null ? String(value) : n.toLocaleString();
    }
  }
}

function aggregate(
  data: unknown,
  rootPath: string | undefined,
  metric: StatMetric,
): unknown {
  if (metric.aggregate === "raw") {
    return getPath(data, metric.valuePath);
  }
  const rows = getArray(data, rootPath);
  const values = rows
    .map((row) => toNumber(getPath(row, metric.valuePath)))
    .filter((v): v is number => v !== null);
  switch (metric.aggregate) {
    case "count":
      return rows.length;
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case "min":
      return values.length ? Math.min(...values) : 0;
    case "max":
      return values.length ? Math.max(...values) : 0;
    default:
      return undefined;
  }
}

const COLS_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "grid grid-cols-1 gap-3",
  2: "grid grid-cols-1 gap-3 sm:grid-cols-2",
  3: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4",
};

export function StatBlock({ pageId, block }: { pageId: string; block: BlockDef }) {
  const config = (block.config as StatConfig | null) ?? { metrics: [] };
  const rootPath =
    block.dataSource?.mode === "raw" ? block.dataSource.rootPath : undefined;
  const { data, isLoading, isError, error } = useBlockData(pageId, block.id);

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          {(error as Error)?.message ?? "Failed to load data"}
        </CardContent>
      </Card>
    );
  }

  const metrics = config.metrics ?? [];

  return (
    <div className="space-y-3">
      {config.title ? (
        <h3 className="text-sm font-medium text-muted-foreground">
          {config.title}
        </h3>
      ) : null}
      <div className={COLS_CLASS[config.columns ?? 3]}>
        {metrics.map((metric, i) => {
          const value = aggregate(data, rootPath, metric);
          return (
            <Card key={i}>
              <CardContent className="py-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {metric.icon ? (
                    <DynamicIcon name={metric.icon} className="size-4" />
                  ) : null}
                  <span>{metric.label}</span>
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">
                  {isLoading ? (
                    <Skeleton className="h-7 w-20" />
                  ) : (
                    formatValue(value, metric.format ?? "text")
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
