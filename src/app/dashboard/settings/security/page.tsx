import { SecurityClient } from "./security-client";

export const metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground">
          Manage your password and sign-in security.
        </p>
      </div>
      <SecurityClient />
    </div>
  );
}
