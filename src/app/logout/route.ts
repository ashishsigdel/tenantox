import { signOut } from "@/auth";

/**
 * Clears the session cookie and lands on /login. Server components can't mutate
 * cookies during render, so a stale session (e.g. the user was deleted or the
 * DB was reset while a JWT was still live) is redirected here by
 * getWorkspaceContext to actually sign out — otherwise the proxy keeps bouncing
 * the still-present cookie between /dashboard and /login in a 307 loop.
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
