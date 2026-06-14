"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { UsersClient } from "@/app/dashboard/settings/(admin)/users/users-client";
import { listMembers, type MemberRow } from "@/server/actions/users";
import { getMyProfile } from "@/server/actions/account";

interface UsersData {
  members: MemberRow[];
  currentUserId: string;
}

export function UsersSection() {
  const [data, setData] = useState<UsersData | null>(null);

  const load = useCallback(async () => {
    const [members, profile] = await Promise.all([listMembers(), getMyProfile()]);
    const currentUserId = members.find((m) => m.email === profile.email)?.userId ?? "";
    setData({ members, currentUserId });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          People who can access this workspace and what they&apos;re allowed to do.
        </p>
      </div>
      <UsersClient
        members={data.members}
        currentUserId={data.currentUserId}
        onRefresh={load}
      />
    </div>
  );
}
