"use client";

/**
 * Client-side data plane access. Everything goes through POST /api/proxy;
 * components never call fetch directly.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import type {
  ApiResponse,
  DataRecord,
  ListMeta,
  ListQuery,
} from "@/types/api";
import type { CrudOperation } from "@/types/meta";

export class DataApiError extends Error {
  code: string;
  fields?: Record<string, string>;

  constructor(code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.fields = fields;
  }
}

async function callProxy<T>(body: {
  resourceSlug: string;
  operation: CrudOperation;
  id?: string | number;
  query?: Partial<ListQuery>;
  payload?: DataRecord;
}): Promise<{ data: T; meta?: ListMeta }> {
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new DataApiError("INTERNAL_ERROR", "Unexpected non-JSON response");
  }

  if (!json.success) {
    throw new DataApiError(
      json.error.code,
      json.error.message,
      json.error.fields,
    );
  }
  return { data: json.data, meta: json.meta };
}

export function useRecordList(resourceSlug: string, query: Partial<ListQuery>) {
  return useQuery({
    queryKey: ["records", resourceSlug, query],
    queryFn: () =>
      callProxy<DataRecord[]>({ resourceSlug, operation: "list", query }),
    placeholderData: keepPreviousData,
  });
}

export function useRecord(resourceSlug: string, id: string | undefined) {
  return useQuery({
    queryKey: ["record", resourceSlug, id],
    queryFn: () =>
      callProxy<DataRecord>({ resourceSlug, operation: "getOne", id }),
    enabled: id != null,
  });
}

export function useCreateRecord(resourceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DataRecord) =>
      callProxy<DataRecord>({ resourceSlug, operation: "create", payload }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["records", resourceSlug] }),
  });
}

export function useUpdateRecord(resourceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string | number;
      payload: DataRecord;
    }) => callProxy<DataRecord>({ resourceSlug, operation: "update", id, payload }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["records", resourceSlug] });
      queryClient.invalidateQueries({
        queryKey: ["record", resourceSlug, String(id)],
      });
    },
  });
}

export function useDeleteRecord(resourceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) =>
      callProxy<null>({ resourceSlug, operation: "delete", id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["records", resourceSlug] }),
  });
}

/** Loads options for RELATION / dynamic SELECT fields from another resource. */
export function useRelationOptions(
  resourceSlug: string | undefined,
  labelField: string,
  valueField: string,
  search?: string,
) {
  return useQuery({
    queryKey: ["relation-options", resourceSlug, search],
    queryFn: async () => {
      const { data } = await callProxy<DataRecord[]>({
        resourceSlug: resourceSlug!,
        operation: "list",
        query: { page: 1, pageSize: 50, search: search || undefined },
      });
      return data.map((record) => ({
        label: String(record[labelField] ?? record[valueField] ?? ""),
        value: String(record[valueField] ?? ""),
      }));
    },
    enabled: !!resourceSlug,
  });
}
