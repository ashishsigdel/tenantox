"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES } from "@/lib/roles";
import { savePage, type PageInput } from "@/server/actions/pages";
import type { Role } from "@prisma/client";

export function PageSettingsForm({
  initial,
  isNew,
}: {
  initial: PageInput;
  isNew?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<PageInput>(initial);

  function set<K extends keyof PageInput>(key: K, value: PageInput[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const result = await savePage(draft);
      if (result.ok) {
        toast.success(isNew ? "Page created — now add blocks" : "Page saved");
        if (isNew && result.id) {
          router.push(`/dashboard/settings/pages/${result.id}`);
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
          <CardTitle>Page settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Sales overview"
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              value={draft.slug}
              onChange={(e) =>
                set(
                  "slug",
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                )
              }
              placeholder="sales-overview"
            />
            <p className="text-xs text-muted-foreground">
              URL: /dashboard/p/{draft.slug || "…"}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Icon (lucide name)</Label>
            <Input
              value={draft.icon ?? ""}
              onChange={(e) => set("icon", e.target.value)}
              placeholder="layout-dashboard"
            />
          </div>
          <div className="space-y-2">
            <Label>Minimum role to view</Label>
            <Select
              value={draft.viewRole}
              onValueChange={(v) => set("viewRole", v as Role)}
            >
              <SelectTrigger className="w-full">
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
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional subtitle shown under the page title."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {isNew ? "Create page" : "Save changes"}
      </Button>
    </div>
  );
}
