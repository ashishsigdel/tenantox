"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { updateProfile } from "@/server/actions/account";

export function AccountClient({
  name: initialName,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);

  const dirty = name.trim() !== initialName;

  function save() {
    startTransition(async () => {
      const result = await updateProfile({ name: name.trim() });
      if (result.ok) {
        toast.success("Profile updated");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your display name.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled />
          <p className="text-xs text-muted-foreground">
            Email is used to sign in and can&apos;t be changed here.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <div>
            <Badge variant="secondary">{role}</Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={save} disabled={pending || !dirty || !name.trim()}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}
