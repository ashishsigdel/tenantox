"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { JsonHighlight } from "@/components/ui/json-highlight";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteConnection,
  saveConnection,
  testConnection,
  type ConnectionInput,
  type TestConnectionResult,
} from "@/server/actions/connections";
import type { AuthType } from "@prisma/client";

interface ConnectionRow {
  id: string;
  name: string;
  baseUrl: string;
  authType: AuthType;
  resourceCount: number;
}

const AUTH_LABELS: Record<AuthType, string> = {
  NONE: "None",
  BEARER_TOKEN: "Bearer token",
  API_KEY_HEADER: "API key header",
  BASIC: "Basic auth",
};

const EMPTY: ConnectionInput = {
  name: "",
  baseUrl: "",
  authType: "NONE",
};

export function ConnectionsClient({
  connections,
}: {
  connections: ConnectionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ConnectionInput>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testPath, setTestPath] = useState("/products");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  function openCreate() {
    setDraft(EMPTY);
    setTestResult(null);
    setDialogOpen(true);
  }

  function openEdit(row: ConnectionRow) {
    setDraft({
      id: row.id,
      name: row.name,
      baseUrl: row.baseUrl,
      authType: row.authType,
    });
    setTestResult(null);
    setDialogOpen(true);
  }

  function set<K extends keyof ConnectionInput>(
    key: K,
    value: ConnectionInput[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const result = await saveConnection(draft);
      if (result.ok) {
        toast.success(draft.id ? "Connection updated" : "Connection created");
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function runTest() {
    if (!draft.baseUrl) {
      toast.error("Enter a base URL first");
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testConnection({
      baseUrl: draft.baseUrl,
      testPath,
      authType: draft.authType,
      token: draft.token,
      headerName: draft.headerName,
      apiKey: draft.apiKey,
      username: draft.username,
      password: draft.password,
    });
    setTesting(false);
    setTestResult(result);
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      const result = await deleteConnection(id);
      if (result.ok) {
        toast.success("Connection deleted");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> New connection
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="max-w-[200px]">Base URL</TableHead>
              <TableHead>Auth</TableHead>
              <TableHead>Resources</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No connections yet.
                </TableCell>
              </TableRow>
            )}
            {connections.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="max-w-[200px]">
                  <span
                    className="block truncate font-mono text-xs"
                    title={row.baseUrl}
                  >
                    {row.baseUrl}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{AUTH_LABELS[row.authType]}</Badge>
                </TableCell>
                <TableCell>{row.resourceCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => setDeleteId(row.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {draft.id ? "Edit connection" : "New connection"}
            </DialogTitle>
            <DialogDescription>
              The external API must implement the response contract — see the
              API Docs page.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="My Project API"
              />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={draft.baseUrl}
                onChange={(e) => set("baseUrl", e.target.value)}
                placeholder="https://api.example.com/admin"
              />
            </div>
            <div className="space-y-2">
              <Label>Authentication</Label>
              <Select
                value={draft.authType}
                onValueChange={(v) => set("authType", v as AuthType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AUTH_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {draft.authType === "BEARER_TOKEN" && (
              <div className="space-y-2">
                <Label>Token</Label>
                <Input
                  type="password"
                  value={draft.token ?? ""}
                  onChange={(e) => set("token", e.target.value)}
                  placeholder={draft.id ? "Leave blank to keep current" : ""}
                />
              </div>
            )}
            {draft.authType === "API_KEY_HEADER" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Header name</Label>
                  <Input
                    value={draft.headerName ?? ""}
                    onChange={(e) => set("headerName", e.target.value)}
                    placeholder="x-api-key"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Key</Label>
                  <Input
                    type="password"
                    value={draft.apiKey ?? ""}
                    onChange={(e) => set("apiKey", e.target.value)}
                    placeholder={draft.id ? "Leave blank to keep" : ""}
                  />
                </div>
              </div>
            )}
            {draft.authType === "BASIC" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={draft.username ?? ""}
                    onChange={(e) => set("username", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={draft.password ?? ""}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder={draft.id ? "Leave blank to keep" : ""}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs text-muted-foreground">
                Test: GET a list endpoint and validate the envelope
              </Label>
              <div className="flex gap-2">
                <Input
                  value={testPath}
                  onChange={(e) => setTestPath(e.target.value)}
                  placeholder="/products"
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={runTest}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FlaskConical className="size-4" />
                  )}
                  Test
                </Button>
              </div>

              {testResult && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-semibold ${
                        testResult.status !== undefined
                          ? testResult.status >= 200 && testResult.status < 300
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          : testResult.ok
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      }`}
                    >
                      {testResult.status !== undefined
                        ? `HTTP ${testResult.status}`
                        : testResult.ok
                          ? "OK"
                          : "Error"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {testResult.message}
                    </span>
                  </div>
                  {testResult.body !== undefined && (
                    <JsonHighlight value={testResult.body} />
                  )}
                </div>
              )}
            </div>
          </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {draft.id ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete connection?</AlertDialogTitle>
            <AlertDialogDescription>
              Connections still used by resources can&apos;t be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
