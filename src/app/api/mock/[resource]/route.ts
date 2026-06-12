import type { NextRequest } from "next/server";
import type { DataRecord } from "@/types/api";
import { getCollection } from "../_store";
import { applyListQuery, fail, ok, validateRequired } from "../_contract";

// GET /api/mock/{resource} — list
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const collection = getCollection(resource);
  const { rows, meta } = applyListQuery(
    collection.records,
    req.nextUrl.searchParams,
  );
  return ok(rows, meta);
}

// POST /api/mock/{resource} — create
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const collection = getCollection(resource);

  let body: DataRecord;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be JSON");
  }

  const fieldErrors = validateRequired(body, collection.required);
  if (fieldErrors) {
    return fail("VALIDATION_ERROR", "Validation failed", fieldErrors);
  }

  const now = new Date().toISOString();
  const record: DataRecord = {
    ...body,
    id: String(collection.nextId++),
    createdAt: now,
    updatedAt: now,
  };
  collection.records.push(record);
  return ok(record, undefined, 201);
}
