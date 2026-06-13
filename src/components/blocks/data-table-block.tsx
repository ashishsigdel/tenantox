"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getArray, getPath } from "@/lib/json-path";
import type { BlockDef, TableBlockConfig, TableColumn } from "@/types/meta";

import { useGroupData } from "./group-block";

/** Derives columns from the first row's keys when none are configured. */
function deriveColumns(rows: unknown[]): TableColumn[] {
  const first = rows.find((r) => r && typeof r === "object");
  if (!first) return [];
  return Object.keys(first as Record<string, unknown>).map((key) => ({
    key,
    label: key,
  }));
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Read-only table for a block inside a group: renders rows from the group's
 * single response, sliced by the block's `rootPath`.
 */
export function DataTableBlock({ block }: { block: BlockDef }) {
  const config = (block.config as TableBlockConfig | null) ?? {};
  const ds = block.dataSource;
  const rootPath = ds?.mode === "group" ? ds.rootPath : undefined;

  const group = useGroupData();

  const rows = group ? getArray(group.data, rootPath) : [];
  const columns = config.columns?.length ? config.columns : deriveColumns(rows);

  return (
    <Card>
      {config.title ? (
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>
        {group?.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : group?.isError ? (
          <p className="py-6 text-sm text-destructive">
            {(group.error as Error)?.message ?? "Failed to load data"}
          </p>
        ) : columns.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No data to show.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {renderCell(getPath(row, col.key))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
