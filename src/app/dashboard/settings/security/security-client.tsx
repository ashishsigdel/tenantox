"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/server/actions/account";

const EMPTY = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function SecurityClient() {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY);

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const filled =
    form.currentPassword && form.newPassword && form.confirmPassword;

  function submit() {
    startTransition(async () => {
      const result = await changePassword(form);
      if (result.ok) {
        toast.success("Password changed");
        setForm(EMPTY);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          Use at least 8 characters. You&apos;ll stay signed in on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current">Current password</Label>
          <Input
            id="current"
            type="password"
            value={form.currentPassword}
            onChange={(e) => set("currentPassword", e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new">New password</Label>
          <Input
            id="new"
            type="password"
            value={form.newPassword}
            onChange={(e) => set("newPassword", e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            autoComplete="new-password"
          />
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={submit} disabled={pending || !filled}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Update password
        </Button>
      </CardFooter>
    </Card>
  );
}
