/**
 * Builds Zod validation schemas, default values, and API payloads at runtime
 * from FieldDefinitions. This is what makes forms fully config-driven.
 */
import { z } from "zod";
import type { DataRecord } from "@/types/api";
import type { FieldDef, VisibleIf } from "@/types/meta";

export function isFieldVisible(
  rule: VisibleIf | null,
  values: Record<string, unknown>,
): boolean {
  if (!rule) return true;
  const actual = values[rule.field];
  switch (rule.operator) {
    case "eq":
      return String(actual) === String(rule.value);
    case "neq":
      return String(actual) !== String(rule.value);
    case "in":
      return (
        Array.isArray(rule.value) &&
        rule.value.map(String).includes(String(actual))
      );
    case "truthy":
      return actual === true || actual === "true";
    default:
      return true;
  }
}

function message(field: FieldDef, rule: string, fallback: string): string {
  return field.validation?.messages?.[rule] ?? fallback;
}

function stringSchema(field: FieldDef): z.ZodType {
  const v = field.validation;
  let schema = z.string();

  if (field.type === "EMAIL") {
    schema = schema.regex(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message(field, "email", "Enter a valid email address"),
    );
  }
  if (field.type === "URL") {
    schema = schema.regex(
      /^https?:\/\/.+/,
      message(field, "url", "Enter a valid URL (https://…)"),
    );
  }
  if (field.type === "SLUG") {
    schema = schema.regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      message(field, "slug", "Lowercase letters, numbers and dashes only"),
    );
  }
  if (v?.minLength != null) {
    schema = schema.min(
      v.minLength,
      message(field, "minLength", `Must be at least ${v.minLength} characters`),
    );
  }
  if (v?.maxLength != null) {
    schema = schema.max(
      v.maxLength,
      message(field, "maxLength", `Must be at most ${v.maxLength} characters`),
    );
  }
  if (v?.pattern) {
    try {
      schema = schema.regex(
        new RegExp(v.pattern),
        message(field, "pattern", "Invalid format"),
      );
    } catch {
      // Ignore invalid regex stored in config rather than crashing the form.
    }
  }

  if (v?.required) {
    return schema.min(1, message(field, "required", `${field.label} is required`));
  }
  return schema.optional().or(z.literal(""));
}

function numberSchema(field: FieldDef): z.ZodType {
  const v = field.validation;
  let schema = z.coerce.number({
    error: message(field, "number", `${field.label} must be a number`),
  } as never) as z.ZodNumber;

  const min = v?.min ?? field.config?.min;
  const max = v?.max ?? field.config?.max;
  if (min != null) {
    schema = schema.min(min, message(field, "min", `Must be at least ${min}`));
  }
  if (max != null) {
    schema = schema.max(max, message(field, "max", `Must be at most ${max}`));
  }

  if (v?.required) return schema;
  // Empty input arrives as "" — treat it as absent.
  return z.preprocess((val) => (val === "" || val == null ? undefined : val), schema.optional());
}

export function buildFieldSchema(field: FieldDef): z.ZodType {
  switch (field.type) {
    case "NUMBER":
      return numberSchema(field);
    case "BOOLEAN":
      return z.boolean().default(false);
    case "MULTI_SELECT": {
      const base = z.array(z.string());
      return field.validation?.required
        ? base.min(1, message(field, "required", "Select at least one option"))
        : base;
    }
    case "JSON": {
      const base = z.string().refine(
        (val) => {
          if (val === "") return true;
          try {
            JSON.parse(val);
            return true;
          } catch {
            return false;
          }
        },
        { message: message(field, "json", "Must be valid JSON") },
      );
      return field.validation?.required
        ? base.refine((val) => val !== "", {
            message: message(field, "required", `${field.label} is required`),
          })
        : base;
    }
    default:
      return stringSchema(field);
  }
}

/** Schema covering only the currently visible form fields. */
export function buildFormSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    shape[field.key] = buildFieldSchema(field);
  }
  return z.object(shape);
}

export function buildDefaultValues(
  fields: FieldDef[],
  record?: DataRecord,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const existing = record?.[field.key];
    if (existing !== undefined && existing !== null) {
      if (field.type === "BOOLEAN") {
        values[field.key] = existing === true || existing === "true";
      } else if (field.type === "MULTI_SELECT") {
        values[field.key] = Array.isArray(existing) ? existing.map(String) : [];
      } else if (field.type === "JSON") {
        values[field.key] =
          typeof existing === "string"
            ? existing
            : JSON.stringify(existing, null, 2);
      } else if (field.type === "DATE") {
        values[field.key] = String(existing).slice(0, 10);
      } else if (field.type === "DATETIME") {
        values[field.key] = String(existing).slice(0, 16);
      } else {
        values[field.key] = String(existing);
      }
      continue;
    }

    if (field.type === "BOOLEAN") {
      values[field.key] = field.defaultValue === "true";
    } else if (field.type === "MULTI_SELECT") {
      values[field.key] = [];
    } else {
      values[field.key] = field.defaultValue ?? "";
    }
  }
  return values;
}

/** Converts validated form values into the JSON payload sent to the API. */
export function buildPayload(
  fields: FieldDef[],
  values: Record<string, unknown>,
): DataRecord {
  const payload: DataRecord = {};
  for (const field of fields) {
    const value = values[field.key];
    switch (field.type) {
      case "NUMBER":
        payload[field.key] =
          value === "" || value == null ? null : Number(value);
        break;
      case "BOOLEAN":
        payload[field.key] = value === true;
        break;
      case "JSON":
        payload[field.key] =
          value === "" || value == null ? null : JSON.parse(String(value));
        break;
      case "DATETIME":
        payload[field.key] =
          value === "" || value == null
            ? null
            : new Date(String(value)).toISOString();
        break;
      default:
        payload[field.key] = value === "" || value == null ? null : value;
    }
  }
  return payload;
}
