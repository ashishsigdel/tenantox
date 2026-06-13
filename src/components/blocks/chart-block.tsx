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
import { getArray, getPath, toNumber } from "@/lib/json-path";
import type { BlockDef, ChartConfig } from "@/types/meta";

const PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function ChartBlock({ block }: { block: BlockDef }) {
  const config = block.config as ChartConfig | null;
  const rootPath =
    block.dataSource?.mode === "raw" ? block.dataSource.rootPath : undefined;
  const { data, isLoading, isError, error } = useBlockData(block.id);

  if (!config || !config.series?.length) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          This chart isn&apos;t configured yet.
        </CardContent>
      </Card>
    );
  }

  const rows = getArray(data, rootPath).map((row, i) => {
    const point: Record<string, unknown> = {
      __x: getPath(row, config.xPath) ?? i,
    };
    config.series.forEach((s) => {
      point[s.label] = toNumber(getPath(row, s.yPath)) ?? 0;
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
            {renderChart(config, rows)}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function renderChart(
  config: ChartConfig,
  rows: Record<string, unknown>[],
): React.ReactElement {
  const color = (i: number, fallback?: string) =>
    fallback || PALETTE[i % PALETTE.length];

  if (config.chartType === "pie" || config.chartType === "donut") {
    const s = config.series[0];
    return (
      <PieChart>
        <Tooltip />
        <Legend />
        <Pie
          data={rows}
          dataKey={s.label}
          nameKey="__x"
          innerRadius={config.chartType === "donut" ? 60 : 0}
          outerRadius={100}
          label
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={color(i)} />
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
        <Legend />
        {config.series.map((s, i) => (
          <Bar key={s.label} dataKey={s.label} fill={color(i, s.color)} radius={[4, 4, 0, 0]} />
        ))}
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
        {config.series.map((s, i) => (
          <Area
            key={s.label}
            type="monotone"
            dataKey={s.label}
            stroke={color(i, s.color)}
            fill={color(i, s.color)}
            fillOpacity={0.2}
          />
        ))}
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
      {config.series.map((s, i) => (
        <Line
          key={s.label}
          type="monotone"
          dataKey={s.label}
          stroke={color(i, s.color)}
          strokeWidth={2}
          dot={false}
        />
      ))}
    </LineChart>
  );
}
