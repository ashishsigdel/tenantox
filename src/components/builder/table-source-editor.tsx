"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveResource, type ResourceInput } from "@/server/actions/resources";

type Connection = { id: string; name: string };
type ResourceOption = { id: string; name: string; slug: string };

/** Defaults for a freshly created data source; fields are added in the editor. */
function defaultResourceInput(
  name: string,
  slug: string,
  connectionId: string,
): ResourceInput {
  return {
    name,
    slug,
    icon: "",
    apiConnectionId: connectionId,
    endpoints: {
      list: { method: "GET", path: `/${slug}`, enabled: true },
      getOne: { method: "GET", path: `/${slug}/{id}`, enabled: true },
      create: { method: "POST", path: `/${slug}`, enabled: true },
      update: { method: "PUT", path: `/${slug}/{id}`, enabled: true },
      delete: { method: "DELETE", path: `/${slug}/{id}`, enabled: true },
    },
    primaryKeyField: "id",
    titleField: "name",
    capabilities: { view: true, create: true, update: true, delete: true },
    permissions: {
      view: "VIEWER",
      create: "EDITOR",
      update: "EDITOR",
      delete: "ADMIN",
    },
  };
}

export function TableSourceEditor({
  value,
  onChange,
  connections,
  resources,
}: {
  value: string;
  onChange: (resourceId: string) => void;
  connections: Connection[];
  resources: ResourceOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [connectionId, setConnectionId] = useState("");

  const linked = resources.find((r) => r.id === value);

  // Already linked: show it + a deep link to the full editor.
  if (value) {
    return (
      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-sm font-medium">Data source</p>
        <p className="text-sm text-muted-foreground">
          Linked to <span className="font-medium">{linked?.name ?? value}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/settings/resources/${value}`}>
              <ExternalLink className="size-4" /> Edit data source
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onChange("")}>
            Change
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Endpoints (and which are enabled), fields, and permissions are set in
          the data source editor.
        </p>
      </div>
    );
  }

  function create() {
    if (!name.trim() || !slug.trim() || !connectionId) {
      toast.error("Name, slug, and connection are required");
      return;
    }
    startTransition(async () => {
      const result = await saveResource(
        defaultResourceInput(name.trim(), slug.trim(), connectionId),
      );
      if (result.ok && result.id) {
        toast.success("Data source created — opening editor for fields");
        onChange(result.id);
        router.push(`/dashboard/settings/resources/${result.id}?tab=fields`);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Data source</p>
      <div className="flex gap-1 rounded-md bg-muted p-1 text-sm">
        <button
          type="button"
          className={`flex-1 rounded px-2 py-1 ${mode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setMode("existing")}
        >
          Reuse existing
        </button>
        <button
          type="button"
          className={`flex-1 rounded px-2 py-1 ${mode === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setMode("new")}
        >
          Create new
        </button>
      </div>

      {mode === "existing" ? (
        <div className="space-y-2">
          <Label>Pick a data source</Label>
          <Select value="" onValueChange={onChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a data source" />
            </SelectTrigger>
            <SelectContent>
              {resources.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  None yet — create one.
                </div>
              ) : (
                resources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Products"
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
              placeholder="products"
            />
          </div>
          <div className="space-y-2">
            <Label>API connection</Label>
            <Select value={connectionId} onValueChange={setConnectionId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a connection" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={create} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create &amp; configure
          </Button>
        </div>
      )}
    </div>
  );
}
