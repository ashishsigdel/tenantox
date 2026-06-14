"use client";

import { SecurityClient } from "@/app/dashboard/settings/security/security-client";

export function SecuritySection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground">Manage your password and sign-in security.</p>
      </div>
      <SecurityClient />
    </div>
  );
}
