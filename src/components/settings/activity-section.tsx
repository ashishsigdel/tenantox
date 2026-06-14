"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listActivityLogs, type ActivityLogRow } from "@/server/actions/activity";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
  CONFIG_CHANGE: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

export function ActivitySection() {
  const [data, setData] = useState<ActivityLogRow[] | null>(null);

  const load = useCallback(async () => {
    const rows = await listActivityLogs();
    setData(rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity Log</h1>
        <p className="text-sm text-muted-foreground">The last 200 data and configuration changes.</p>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No activity yet.
                </TableCell>
              </TableRow>
            )}
            {data.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>{log.userName}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={ACTION_COLORS[log.action]}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  {log.resourceSlug ?? "—"}
                  {log.recordId ? ` #${log.recordId}` : ""}
                </TableCell>
                <TableCell className="max-w-[320px] truncate font-mono text-xs text-muted-foreground">
                  {log.detail ? JSON.stringify(log.detail) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
