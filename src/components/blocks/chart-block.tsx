"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBlockData } from "@/lib/data-provider";
import { getPath, toNumber } from "@/lib/json-path";
import type { BlockDef, ChartConfig } from "@/types/meta";

import { useGroupData } from "./group-block";

const PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function ChartBlock({ pageId, block }: { pageId: string; block: BlockDef }) {
  const config = block.config as ChartConfig | null;
  const ds = block.dataSource;
  const rootPath =
    ds?.mode === "raw" || ds?.mode === "group" ? ds.rootPath : undefined;
  // Inside a group, read the group's single fetch from context; otherwise the
  // block fetches its own raw source.
  const group = useGroupData();
  const inGroup = ds?.mode === "group" && group !== null;
  const own = useBlockData(pageId, block.id, undefined, !inGroup && ds?.mode === "raw");
  const { data, isLoading, isError, error } = inGroup ? group : own;

  if (!config || !config.series?.length) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          This chart isn&apos;t configured yet.
        </CardContent>
      </Card>
    );
  }

  // Two shapes are supported:
  //  • Array mode — the root path is a JSON list; render one point per element,
  //    with each series a column read via its yPath (keyed by index, since
  //    labels may be empty or duplicated).
  //  • Scalar mode — the root path is a single object (e.g. a KPI snapshot with
  //    no array anywhere); render one point per series, the series label as the
  //    category and its yPath resolved against that object.
  const rootValue = getPath(data, rootPath);
  const scalar = !Array.isArray(rootValue);

  const rows: Record<string, unknown>[] = scalar
    ? config.series.map((s, si) => ({
        __x: s.label || `Series ${si + 1}`,
        value: toNumber(getPath(rootValue, s.yPath)) ?? 0,
        __fill: s.color || PALETTE[si % PALETTE.length],
      }))
    : (rootValue as unknown[]).map((row, i) => {
        const point: Record<string, unknown> = {
          __x: getPath(row, config.xPath) ?? i,
        };
        config.series.forEach((s, si) => {
          point[`s${si}`] = toNumber(getPath(row, s.yPath)) ?? 0;
        });
        return point;
      });

  return (
    <Card>
      {config.title ? (
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <p className="py-6 text-sm text-destructive">
            {(error as Error)?.message ?? "Failed to load data"}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            {renderChart(config, rows, scalar)}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function renderChart(
  config: ChartConfig,
  rows: Record<string, unknown>[],
  scalar: boolean,
): React.ReactElement {
  const color = (i: number, fallback?: string) =>
    fallback || PALETTE[i % PALETTE.length];

  if (config.chartType === "pie" || config.chartType === "donut") {
    return (
      <PieChart>
        <Tooltip />
        <Legend />
        <Pie
          data={rows}
          dataKey={scalar ? "value" : "s0"}
          nameKey="__x"
          innerRadius={config.chartType === "donut" ? 60 : 0}
          outerRadius={100}
          label
        >
          {rows.map((row, i) => (
            <Cell key={i} fill={(scalar && (row.__fill as string)) || color(i)} />
          ))}
        </Pie>
      </PieChart>
    );
  }

  if (config.chartType === "bar") {
    return (
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="__x" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        {scalar ? (
          // Each bar is labelled on the X axis, so no legend is needed.
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {rows.map((row, i) => (
              <Cell key={i} fill={(row.__fill as string) || color(i)} />
            ))}
          </Bar>
        ) : (
          <>
            <Legend />
            {config.series.map((s, i) => (
              <Bar
                key={i}
                dataKey={`s${i}`}
                name={s.label || `Series ${i + 1}`}
                fill={color(i, s.color)}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </>
        )}
      </BarChart>
    );
  }

  if (config.chartType === "area") {
    return (
      <AreaChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="__x" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Legend />
        {scalar ? (
          <Area
            type="monotone"
            dataKey="value"
            name={config.title || "Value"}
            stroke={color(0)}
            fill={color(0)}
            fillOpacity={0.2}
          />
        ) : (
          config.series.map((s, i) => (
            <Area
              key={i}
              type="monotone"
              dataKey={`s${i}`}
              name={s.label || `Series ${i + 1}`}
              stroke={color(i, s.color)}
              fill={color(i, s.color)}
              fillOpacity={0.2}
            />
          ))
        )}
      </AreaChart>
    );
  }

  return (
    <LineChart data={rows}>
      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
      <XAxis dataKey="__x" fontSize={12} />
      <YAxis fontSize={12} />
      <Tooltip />
      <Legend />
      {scalar ? (
        <Line
          type="monotone"
          dataKey="value"
          name={config.title || "Value"}
          stroke={color(0)}
          strokeWidth={2}
          dot
        />
      ) : (
        config.series.map((s, i) => (
          <Line
            key={i}
            type="monotone"
            dataKey={`s${i}`}
            name={s.label || `Series ${i + 1}`}
            stroke={color(i, s.color)}
            strokeWidth={2}
            dot={false}
          />
        ))
      )}
    </LineChart>
  );
}
