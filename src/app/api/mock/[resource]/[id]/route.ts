import type { NextRequest } from "next/server";
import type { DataRecord } from "@/types/api";
import { getCollection } from "../../_store";
import { fail, ok, validateRequired } from "../../_contract";

type Params = { params: Promise<{ resource: string; id: string }> };

// GET /api/mock/{resource}/{id}
export async function GET(_req: NextRequest, { params }: Params) {
  const { resource, id } = await params;
  const record = getCollection(resource).records.find((r) => r.id === id);
  if (!record) return fail("NOT_FOUND", `Record ${id} not found`);
  return ok(record);
}

// PUT /api/mock/{resource}/{id}
export async function PUT(req: NextRequest, { params }: Params) {
  const { resource, id } = await params;
  const collection = getCollection(resource);
  const index = collection.records.findIndex((r) => r.id === id);
  if (index === -1) return fail("NOT_FOUND", `Record ${id} not found`);

  let body: DataRecord;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be JSON");
  }

  const merged = { ...collection.records[index], ...body };
  const fieldErrors = validateRequired(merged, collection.required);
  if (fieldErrors) {
    return fail("VALIDATION_ERROR", "Validation failed", fieldErrors);
  }

  collection.records[index] = {
    ...merged,
    id,
    updatedAt: new Date().toISOString(),
  };
  return ok(collection.records[index]);
}

// PATCH behaves like PUT for the mock (partial merge either way).
export const PATCH = PUT;

// DELETE /api/mock/{resource}/{id}
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { resource, id } = await params;
  const collection = getCollection(resource);
  const index = collection.records.findIndex((r) => r.id === id);
  if (index === -1) return fail("NOT_FOUND", `Record ${id} not found`);
  collection.records.splice(index, 1);
  return ok(null);
}
