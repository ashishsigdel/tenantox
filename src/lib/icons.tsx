"use client";

import { icons, Circle, type LucideProps } from "lucide-react";

/** Converts "layout-dashboard" → "LayoutDashboard". */
function toPascalCase(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Renders a lucide icon from a config-stored kebab-case name. */
export function DynamicIcon({
  name,
  ...props
}: { name?: string | null } & Omit<LucideProps, "name">) {
  if (!name) return <Circle {...props} />;
  const Icon = icons[toPascalCase(name) as keyof typeof icons];
  return Icon ? <Icon {...props} /> : <Circle {...props} />;
}
