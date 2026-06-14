"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { AccountClient } from "@/app/dashboard/settings/account/account-client";
import { getMyProfile } from "@/server/actions/account";

type Profile = { name: string; email: string; role: string };

export function AccountSection() {
  const [data, setData] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    const profile = await getMyProfile();
    setData(profile);
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
        <h2 className="text-xl font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">Your personal profile information.</p>
      </div>
      <AccountClient
        name={data.name}
        email={data.email}
        role={data.role}
        onRefresh={load}
      />
    </div>
  );
}
