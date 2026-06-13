"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
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
import { usePreviewSource } from "@/lib/data-provider";
import { saveResource, type ResourceInput } from "@/server/actions/resources";
import { DEFAULT_API_MAPPING } from "@/types/meta";
import type { CrudOperation, FilterStyle } from "@/types/meta";
import type { Role } from "@prisma/client";

const OPERATIONS: { key: CrudOperation; label: string }[] = [
  { key: "list", label: "List" },
  { key: "getOne", label: "Get one" },
  { key: "create", label: "Create" },
  { key: "update", label: "Update" },
  { key: "delete", label: "Delete" },
];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** Sentinel select values (Radix forbids an empty-string item value). */
const USE_DEFAULT = "__default";
const ROOT = "__root";

/**
 * Inspects a tested response and lists where the data could live, so the user
 * picks instead of typing a path. For `list` we look for arrays; otherwise for
 * objects. Scans the root plus up to two levels deep.
 */
function dataCandidates(
  raw: unknown,
  op: CrudOperation,
): { path: string; label: string }[] {
  const wantArray = op === "list";
  const isMatch = (v: unknown) =>
    wantArray
      ? Array.isArray(v)
      : v != null && typeof v === "object" && !Array.isArray(v);

  const out: { path: string; label: string }[] = [];
  if (isMatch(raw)) {
    out.push({ path: ROOT, label: wantArray ? "root (array)" : "root (object)" });
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (isMatch(v)) out.push({ path: k, label: k });
      if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v)) {
          if (isMatch(v2)) out.push({ path: `${k}.${k2}`, label: `${k}.${k2}` });
        }
      }
    }
  }
  return out;
}

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
  const preview = usePreviewSource();
  const [testResult, setTestResult] = useState<{
    op: CrudOperation;
    raw: unknown;
    text: string;
  } | null>(null);

  function set<K extends keyof ResourceInput>(key: K, value: ResourceInput[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const mapping = draft.apiMapping ?? DEFAULT_API_MAPPING;
  function setReq(patch: Partial<typeof mapping.request>) {
    set("apiMapping", {
      request: { ...mapping.request, ...patch },
      response: mapping.response,
    });
  }
  function setRes(patch: Partial<typeof mapping.response>) {
    set("apiMapping", {
      request: mapping.request,
      response: { ...mapping.response, ...patch },
    });
  }

  /** Read-only probe of a GET endpoint via the admin preview proxy. */
  function testEndpoint(op: CrudOperation) {
    if (!draft.apiConnectionId) {
      toast.error("Pick an API connection first");
      return;
    }
    const ep = draft.endpoints[op];
    preview.mutate(
      {
        connectionId: draft.apiConnectionId,
        method: ep.method,
        // getOne paths carry {id}; probe with a sample id of 1.
        path: ep.path.replace("{id}", "1"),
      },
      {
        onSuccess: (data) =>
          setTestResult({
            op,
            raw: data,
            text: JSON.stringify(data, null, 2).slice(0, 4000),
          }),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  function submit() {
    startTransition(async () => {
      // Capabilities are derived from which endpoints are enabled (deprecated,
      // kept in sync for back-compat).
      const ep = draft.endpoints;
      const payload: ResourceInput = {
        ...draft,
        capabilities: {
          view: ep.list.enabled !== false || ep.getOne.enabled !== false,
          create: ep.create.enabled !== false,
          update: ep.update.enabled !== false,
          delete: ep.delete.enabled !== false,
        },
      };
      const result = await saveResource(payload);
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
              Identifies this data source; used by the table&apos;s proxy
              requests.
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
          <p className="text-xs text-muted-foreground">
            Toggle which operations are active. The enabled set decides the
            table UI: list→table, get one→row detail, create→Add button,
            update→Edit, delete→Delete.
          </p>
          {OPERATIONS.map(({ key, label }) => {
            const enabled = draft.endpoints[key].enabled !== false;
            return (
              <div key={key} className="flex items-center gap-2">
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) =>
                    set("endpoints", {
                      ...draft.endpoints,
                      [key]: { ...draft.endpoints[key], enabled: v },
                    })
                  }
                />
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
                  disabled={!enabled}
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
                  disabled={!enabled}
                />
                {draft.endpoints[key].method === "GET" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    disabled={!enabled || preview.isPending}
                    onClick={() => testEndpoint(key)}
                    title="Send a read-only request and preview the response"
                  >
                    {preview.isPending && preview.variables?.path ===
                    draft.endpoints[key].path.replace("{id}", "1") ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    Test
                  </Button>
                )}
              </div>
            );
          })}

          {testResult &&
            (() => {
              const op = testResult.op;
              const dp = draft.endpoints[op].dataPath;
              const selVal =
                dp === undefined ? USE_DEFAULT : dp === "" ? ROOT : dp;
              const options = [
                {
                  path: USE_DEFAULT,
                  label: `Use default (${mapping.response.dataPath || "root"})`,
                },
                ...dataCandidates(testResult.raw, op),
              ];
              if (!options.some((o) => o.path === selVal)) {
                options.push({ path: selVal, label: dp ?? selVal });
              }
              return (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      <code className="rounded bg-muted px-1">{op}</code> data
                      location
                    </span>
                    <Select
                      value={selVal}
                      onValueChange={(v) =>
                        set("endpoints", {
                          ...draft.endpoints,
                          [op]: {
                            ...draft.endpoints[op],
                            dataPath:
                              v === USE_DEFAULT
                                ? undefined
                                : v === ROOT
                                  ? ""
                                  : v,
                          },
                        })
                      }
                    >
                      <SelectTrigger size="sm" className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((o) => (
                          <SelectItem key={o.path} value={o.path}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pick where the record{op === "list" ? "s" : ""} live in this
                    response — no need to type a path. Use the keys below to
                    define your fields.
                  </p>
                  <pre className="max-h-56 overflow-auto rounded bg-muted p-2 text-[11px]">
                    {testResult.text}
                  </pre>
                </div>
              );
            })()}
          <p className="text-xs text-muted-foreground">
            Only GET endpoints can be tested — write operations aren&apos;t fired
            from here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response mapping</CardTitle>
          <CardDescription>
            Where to read records, totals, success, and errors from the API
            response. Defaults shown as placeholders. Use the Test buttons above
            to inspect the real shape.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Data path</Label>
            <Input
              className="font-mono text-xs"
              value={mapping.response.dataPath}
              onChange={(e) => setRes({ dataPath: e.target.value })}
              placeholder="data"
            />
            <p className="text-xs text-muted-foreground">
              Default for every operation. Blank = whole response (root). Each
              endpoint can override this via its Test → data location.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Total path</Label>
            <Input
              className="font-mono text-xs"
              value={mapping.response.totalPath}
              onChange={(e) => setRes({ totalPath: e.target.value })}
              placeholder="meta.total"
            />
            <p className="text-xs text-muted-foreground">
              Total count for pagination, e.g. <code>total</code>,{" "}
              <code>count</code>.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Success path</Label>
            <Input
              className="font-mono text-xs"
              value={mapping.response.successPath ?? ""}
              onChange={(e) => setRes({ successPath: e.target.value })}
              placeholder="(auto: HTTP status)"
            />
            <p className="text-xs text-muted-foreground">
              Path to a success flag. Blank = use HTTP status / envelope
              success.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Error message path</Label>
            <Input
              className="font-mono text-xs"
              value={mapping.response.errorPath ?? ""}
              onChange={(e) => setRes({ errorPath: e.target.value })}
              placeholder="error.message"
            />
            <p className="text-xs text-muted-foreground">
              Where the error text lives on failure, e.g. <code>message</code>,{" "}
              <code>detail</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request mapping</CardTitle>
          <CardDescription>
            Names of the list query params the dashboard sends, and how filters
            are encoded.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Page param</Label>
            <Input
              value={mapping.request.pageParam}
              onChange={(e) => setReq({ pageParam: e.target.value })}
              placeholder="page"
            />
          </div>
          <div className="space-y-2">
            <Label>Page size param</Label>
            <Input
              value={mapping.request.pageSizeParam}
              onChange={(e) => setReq({ pageSizeParam: e.target.value })}
              placeholder="pageSize"
            />
          </div>
          <div className="space-y-2">
            <Label>Sort param</Label>
            <Input
              value={mapping.request.sortParam}
              onChange={(e) => setReq({ sortParam: e.target.value })}
              placeholder="sort"
            />
            <p className="text-xs text-muted-foreground">
              Sent as <code>-field</code> for descending.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Search param</Label>
            <Input
              value={mapping.request.searchParam}
              onChange={(e) => setReq({ searchParam: e.target.value })}
              placeholder="search"
            />
          </div>
          <div className="space-y-2">
            <Label>Filter style</Label>
            <Select
              value={mapping.request.filterStyle}
              onValueChange={(v) => setReq({ filterStyle: v as FilterStyle })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bracket">
                  Bracket — filter[field][op]=value
                </SelectItem>
                <SelectItem value="flat">Flat — field=value (eq only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>
            Minimum role required for each operation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(["view", "create", "update", "delete"] as const).map((op) => (
            <div key={op} className="flex items-center gap-4">
              <span className="w-36 text-sm capitalize">{op}</span>
              <Select
                value={draft.permissions[op]}
                onValueChange={(v) =>
                  set("permissions", { ...draft.permissions, [op]: v as Role })
                }
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
