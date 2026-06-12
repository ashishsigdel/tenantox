/**
 * Reference implementation of the external API contract: list query parsing
 * (page/pageSize/sort/search/filter) and response envelopes.
 */
import { NextResponse } from "next/server";
import type { ApiErrorCode, DataRecord, ListMeta } from "@/types/api";

export function ok<T>(data: T, meta?: ListMeta, status = 200) {
  return NextResponse.json({ success: true, data, ...(meta && { meta }) }, { status });
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
};

export function fail(
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(fields && { fields }) } },
    { status: STATUS_BY_CODE[code] },
  );
}

type FilterOp = "gte" | "lte" | "gt" | "lt" | "ne" | "like" | "in";

function matchesFilter(
  value: unknown,
  op: FilterOp | "eq",
  expected: string,
): boolean {
  if (op === "in") {
    return expected.split(",").some((v) => String(value) === v);
  }
  if (op === "like") {
    return String(value ?? "").toLowerCase().includes(expected.toLowerCase());
  }
  if (op === "eq" || op === "ne") {
    const eq =
      typeof value === "boolean"
        ? String(value) === expected
        : String(value ?? "") === expected;
    return op === "eq" ? eq : !eq;
  }
  const a = Number(value);
  const b = Number(expected);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  if (op === "gte") return a >= b;
  if (op === "lte") return a <= b;
  if (op === "gt") return a > b;
  return a < b;
}

/** Applies ?search, ?filter[...], ?sort, ?page/?pageSize to a record set. */
export function applyListQuery(
  records: DataRecord[],
  searchParams: URLSearchParams,
): { rows: DataRecord[]; meta: ListMeta } {
  let rows = [...records];

  const search = searchParams.get("search");
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((record) =>
      Object.values(record).some(
        (value) =>
          typeof value === "string" && value.toLowerCase().includes(q),
      ),
    );
  }

  // filter[field]=value and filter[field][op]=value
  const filterRe = /^filter\[([^\]]+)\](?:\[([^\]]+)\])?$/;
  for (const [param, expected] of searchParams.entries()) {
    const match = param.match(filterRe);
    if (!match) continue;
    const [, field, op] = match;
    rows = rows.filter((record) =>
      matchesFilter(record[field], (op as FilterOp) ?? "eq", expected),
    );
  }

  const sort = searchParams.get("sort");
  if (sort) {
    const desc = sort.startsWith("-");
    const field = desc ? sort.slice(1) : sort;
    rows.sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return desc ? -cmp : cmp;
    });
  }

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize")) || 10),
  );
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  rows = rows.slice((page - 1) * pageSize, page * pageSize);

  return { rows, meta: { page, pageSize, total, totalPages } };
}

export function validateRequired(
  body: DataRecord,
  required: string[],
): Record<string, string> | null {
  const fields: Record<string, string> = {};
  for (const key of required) {
    const value = body[key];
    if (value === undefined || value === null || value === "") {
      fields[key] = `${key} is required`;
    }
  }
  return Object.keys(fields).length > 0 ? fields : null;
}
