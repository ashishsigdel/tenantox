"use client";

import { useState } from "react";
import { Check, ExternalLink, ImageOff, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FieldDef } from "@/types/meta";

/**
 * Returns a higher-resolution variant of an image URL when the host supports
 * it. Google user content (lh3.googleusercontent.com etc.) encodes the size in
 * a trailing directive like `=s96-c` / `=w96-h96`; we bump it to `=s1024` for a
 * crisp preview. Other hosts are returned unchanged.
 */
function upscaleImageUrl(src: string, size = 1024): string {
  if (!/googleusercontent\.com/.test(src)) return src;
  // Replace an existing size directive, or append one if none is present.
  return /=[swh]\d/.test(src)
    ? src.replace(/=[^=]*$/, `=s${size}`)
    : `${src}=s${size}`;
}

/** Avatar/thumbnail cell. Sends no `Referer` so hotlink-protected hosts (which
 * 403 cross-origin embeds) still load, falls back to a clean placeholder
 * instead of the browser's broken-image glyph when a fetch genuinely fails,
 * and opens a zoomed preview (upscaled, when supported) on click. */
function ImageThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [bigSrc, setBigSrc] = useState(() => upscaleImageUrl(src));

  if (failed) {
    return (
      <div
        className="flex size-9 items-center justify-center rounded-md border bg-muted"
        title={src}
      >
        <ImageOff className="size-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        aria-label="View image"
        className="block cursor-zoom-in rounded-md"
        onClick={(e) => {
          // Don't trigger the row's own click (e.g. open/edit).
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-9 rounded-md border object-cover"
          onError={() => setFailed(true)}
        />
      </button>
      <DialogContent className="max-w-[90vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">Image preview</DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bigSrc}
          alt=""
          referrerPolicy="no-referrer"
          className="mx-auto max-h-[80vh] w-auto rounded-md object-contain"
          // If the upscaled variant fails, fall back to the original URL.
          onError={() => bigSrc !== src && setBigSrc(src)}
        />
      </DialogContent>
    </Dialog>
  );
}

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
      return typeof value === "string" &&
        /^(https?:)?\/\//.test(value.trim()) ? (
        <ImageThumb src={value.trim()} />
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
