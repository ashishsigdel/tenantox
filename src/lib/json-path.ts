/**
 * Minimal dot-path reader for mapping API responses into blocks.
 * Supports nested keys and numeric array indices: "data.items.0.name".
 * Returns undefined for any missing segment.
 */
export function getPath(source: unknown, path: string | undefined): unknown {
  if (!path) return source;
  let current: unknown = source;
  for (const key of path.split(".")) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(key);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Resolves a path to an array, returning [] when it isn't one. */
export function getArray(source: unknown, path: string | undefined): unknown[] {
  const value = getPath(source, path);
  return Array.isArray(value) ? value : [];
}

/** Coerces a value to a finite number, or null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
