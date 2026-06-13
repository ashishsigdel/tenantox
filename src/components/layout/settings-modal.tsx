"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";

import { SettingsNav } from "@/components/layout/settings-nav";

const SETTINGS_ROOT = "/dashboard/settings";

/** Top-level settings sections. Anything deeper shows a back button. */
const SECTION_ROOTS = [
  "/dashboard/settings/account",
  "/dashboard/settings/security",
  "/dashboard/settings/notifications",
  "/dashboard/settings/appearance",
  "/dashboard/settings/connections",
  "/dashboard/settings/resources",
  "/dashboard/settings/pages",
  "/dashboard/settings/menu",
  "/dashboard/settings/users",
  "/dashboard/settings/activity",
];

export const SETTINGS_BG_KEY = "settings:bg";

export function SettingsModal({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [closing, setClosing] = useState(false);

  const activeRoot = SECTION_ROOTS.find(
    (root) => pathname === root || pathname.startsWith(root + "/"),
  );
  const isDeep = !!activeRoot && pathname !== activeRoot;
  const inSettings = pathname.startsWith(SETTINGS_ROOT);

  // Closing fully dismisses the modal from any depth. Pushing the route that's
  // already live behind the modal gets deduped and leaves the intercepting slot
  // mounted, so instead we pop history until we're out of /dashboard/settings
  // (handled by the effect below). With no in-app history (hard-loaded deep
  // link) there's nothing to pop, so we push a fallback route directly.
  const close = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      setClosing(true);
      return;
    }
    let bg = "/dashboard";
    try {
      bg = sessionStorage.getItem(SETTINGS_BG_KEY) || "/dashboard";
    } catch {
      // sessionStorage unavailable — fall back to the dashboard home.
    }
    router.push(bg);
  };

  // Deep sub-routes (e.g. editing a resource) are reached via a pushed entry,
  // so popping returns to the section root.
  const back = () => router.back();

  // While closing, pop one history entry per settings route until we leave the
  // settings tree. The ref guards against React Strict Mode invoking the effect
  // twice for the same path, which would over-pop past the background page.
  const poppedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!closing || !inSettings) return;
    if (poppedFor.current === pathname) return;
    poppedFor.current = pathname;
    router.back();
  }, [closing, inSettings, pathname, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        hidden={closing}
        className="relative flex h-full w-full overflow-hidden bg-background shadow-lg ring-1 ring-border sm:h-[calc(100vh-4rem)] sm:max-w-[calc(100%-4rem)] sm:rounded-xl"
      >
        <aside className="flex w-48 shrink-0 flex-col gap-3 border-r bg-sidebar p-3 sm:w-60 sm:p-4">
          <h2 className="px-2 text-sm font-semibold text-sidebar-foreground">
            Settings
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SettingsNav isAdmin={isAdmin} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
            {isDeep ? (
              <button
                type="button"
                onClick={back}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close settings"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
