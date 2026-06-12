"use client";

import { Check, ExternalLink, ImageOff, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FieldDef } from "@/types/meta";

const BADGE_COLORS: Record<string, string> = {
  green:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  yellow:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  purple:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  orange:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  gray: "bg-muted text-muted-foreground",
};

/** For SELECT-ish fields, show the option label rather than the raw value. */
function displayValue(field: FieldDef, value: unknown): string {
  const options = field.config?.options;
  if (options) {
    const match = options.find((o) => o.value === String(value));
    if (match) return match.label;
  }
  return String(value);
}

export function CellRenderer({
  field,
  value,
}: {
  field: FieldDef;
  value: unknown;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  switch (field.format) {
    case "badge": {
      const color = field.badgeColorMap?.[String(value)];
      return (
        <Badge
          variant="secondary"
          className={cn("font-normal", color && BADGE_COLORS[color])}
        >
          {displayValue(field, value)}
        </Badge>
      );
    }
    case "date":
      return <span>{new Date(String(value)).toLocaleDateString()}</span>;
    case "datetime":
      return <span>{new Date(String(value)).toLocaleString()}</span>;
    case "currency": {
      const num = Number(value);
      return (
        <span className="tabular-nums">
          {Number.isNaN(num)
            ? String(value)
            : num.toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
              })}
        </span>
      );
    }
    case "boolean-icon":
      return value === true || value === "true" ? (
        <Check className="size-4 text-green-600" />
      ) : (
        <X className="size-4 text-muted-foreground" />
      );
    case "image-thumb":
      return typeof value === "string" && value.startsWith("http") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="size-9 rounded-md border object-cover"
        />
      ) : (
        <ImageOff className="size-4 text-muted-foreground" />
      );
    case "truncate":
      return (
        <span className="block max-w-[260px] truncate" title={String(value)}>
          {String(value)}
        </span>
      );
    case "link":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
          <ExternalLink className="size-3" />
        </a>
      );
    default:
      return <span>{displayValue(field, value)}</span>;
  }
}
