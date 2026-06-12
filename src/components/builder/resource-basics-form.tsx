"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ROLES } from "@/lib/roles";
import { saveResource, type ResourceInput } from "@/server/actions/resources";
import type { CrudOperation } from "@/types/meta";
import type { Role } from "@prisma/client";

const OPERATIONS: { key: CrudOperation; label: string }[] = [
  { key: "list", label: "List" },
  { key: "getOne", label: "Get one" },
  { key: "create", label: "Create" },
  { key: "update", label: "Update" },
  { key: "delete", label: "Delete" },
];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export function defaultResourceInput(): ResourceInput {
  return {
    name: "",
    slug: "",
    icon: "",
    apiConnectionId: "",
    endpoints: {
      list: { method: "GET", path: "/items" },
      getOne: { method: "GET", path: "/items/{id}" },
      create: { method: "POST", path: "/items" },
      update: { method: "PUT", path: "/items/{id}" },
      delete: { method: "DELETE", path: "/items/{id}" },
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

/** Suggest endpoint paths from the slug while the user types a new resource. */
function endpointsFromSlug(slug: string): ResourceInput["endpoints"] {
  return {
    list: { method: "GET", path: `/${slug}` },
    getOne: { method: "GET", path: `/${slug}/{id}` },
    create: { method: "POST", path: `/${slug}` },
    update: { method: "PUT", path: `/${slug}/{id}` },
    delete: { method: "DELETE", path: `/${slug}/{id}` },
  };
}

export function ResourceBasicsForm({
  initial,
  connections,
  isNew,
}: {
  initial: ResourceInput;
  connections: { id: string; name: string }[];
  isNew?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ResourceInput>(initial);

  function set<K extends keyof ResourceInput>(key: K, value: ResourceInput[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const result = await saveResource(draft);
      if (result.ok) {
        toast.success(isNew ? "Resource created — now add fields" : "Resource saved");
        if (isNew && result.id) {
          router.push(`/dashboard/settings/resources/${result.id}?tab=fields`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Products"
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              value={draft.slug}
              onChange={(e) => {
                const slug = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-");
                setDraft((d) => ({
                  ...d,
                  slug,
                  ...(isNew && { endpoints: endpointsFromSlug(slug) }),
                }));
              }}
              placeholder="products"
            />
            <p className="text-xs text-muted-foreground">
              URL: /dashboard/r/{draft.slug || "…"}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Icon (lucide name)</Label>
            <Input
              value={draft.icon ?? ""}
              onChange={(e) => set("icon", e.target.value)}
              placeholder="package"
            />
          </div>
          <div className="space-y-2">
            <Label>API Connection</Label>
            <Select
              value={draft.apiConnectionId}
              onValueChange={(v) => set("apiConnectionId", v)}
            >
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
          <div className="space-y-2">
            <Label>Primary key field</Label>
            <Input
              value={draft.primaryKeyField}
              onChange={(e) => set("primaryKeyField", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Title field</Label>
            <Input
              value={draft.titleField}
              onChange={(e) => set("titleField", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Which field labels a record (used in detail views).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>
            Paths are relative to the connection&apos;s base URL.{" "}
            <code className="rounded bg-muted px-1">{"{id}"}</code> is replaced
            with the record id.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {OPERATIONS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm text-muted-foreground">
                {label}
              </span>
              <Select
                value={draft.endpoints[key].method}
                onValueChange={(method) =>
                  set("endpoints", {
                    ...draft.endpoints,
                    [key]: {
                      ...draft.endpoints[key],
                      method: method as (typeof METHODS)[number],
                    },
                  })
                }
              >
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-8 font-mono text-xs"
                value={draft.endpoints[key].path}
                onChange={(e) =>
                  set("endpoints", {
                    ...draft.endpoints,
                    [key]: { ...draft.endpoints[key], path: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capabilities &amp; Permissions</CardTitle>
          <CardDescription>
            Toggle which operations exist, and the minimum role each requires.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(["view", "create", "update", "delete"] as const).map((op) => (
            <div key={op} className="flex items-center gap-4">
              <label className="flex w-36 items-center gap-2 text-sm capitalize">
                <Switch
                  checked={draft.capabilities[op]}
                  onCheckedChange={(v) =>
                    set("capabilities", { ...draft.capabilities, [op]: v })
                  }
                />
                {op}
              </label>
              <Select
                value={draft.permissions[op]}
                onValueChange={(v) =>
                  set("permissions", { ...draft.permissions, [op]: v as Role })
                }
                disabled={!draft.capabilities[op]}
              >
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}+
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {isNew ? "Create resource" : "Save changes"}
      </Button>
    </div>
  );
}
