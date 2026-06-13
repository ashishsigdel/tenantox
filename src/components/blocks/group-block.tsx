"use client";

import { createContext, useContext } from "react";
import type { Role } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBlockData } from "@/lib/data-provider";
import { cn } from "@/lib/utils";
import type { BlockDef, GroupDef } from "@/types/meta";

import { BlockRenderer } from "./block-renderer";

/** Data shared by a Group block with its child blocks (single fetch). */
export interface GroupData {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

const GroupDataContext = createContext<GroupData | null>(null);

/** Child blocks read their slice of the group's single response from here. */
export function useGroupData(): GroupData | null {
  return useContext(GroupDataContext);
}

const COLS_CLASS: Record<1 | 2 | 3 | 4 | 6, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  6: "md:grid-cols-6",
};

/**
 * A Group container: fetches its `source` once, then provides the response to
 * every child block via context. Children pick their slice with a `rootPath`.
 */
export function GroupBlock({
  pageId,
  group,
  role,
}: {
  pageId: string;
  group: GroupDef;
  role: Role;
}) {
  const hasSource = !!group.source;
  const { data, isLoading, isError, error } = useBlockData(
    pageId,
    group.id,
    undefined,
    hasSource,
  );

  const columns = group.config.columns ?? 2;

  const body = (
    <div className={cn("grid grid-cols-1 gap-4", COLS_CLASS[columns])}>
      {group.children.map((child: BlockDef) => (
        <BlockRenderer
          key={child.id}
          pageId={pageId}
          block={child}
          role={role}
          resource={null}
        />
      ))}
    </div>
  );

  return (
    <GroupDataContext.Provider value={{ data, isLoading, isError, error }}>
      {group.config.title ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{group.config.title}</CardTitle>
          </CardHeader>
          <CardContent>{body}</CardContent>
        </Card>
      ) : (
        body
      )}
    </GroupDataContext.Provider>
  );
}
