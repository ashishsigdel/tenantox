"use client";

import { Suspense, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import dynamic from "next/dynamic";

import { SettingsNav } from "@/components/layout/settings-nav";

const AccountSection = dynamic(() =>
  import("@/components/settings/account-section").then((m) => ({ default: m.AccountSection })),
);
const SecuritySection = dynamic(() =>
  import("@/components/settings/security-section").then((m) => ({ default: m.SecuritySection })),
);
const AppearanceSection = dynamic(() =>
  import("@/components/settings/appearance-section").then((m) => ({ default: m.AppearanceSection })),
);
const NotificationsSection = dynamic(() =>
  import("@/components/settings/notifications-section").then((m) => ({ default: m.NotificationsSection })),
);
const ConnectionsSection = dynamic(() =>
  import("@/components/settings/connections-section").then((m) => ({ default: m.ConnectionsSection })),
);
const PagesSection = dynamic(() =>
  import("@/components/settings/pages-section").then((m) => ({ default: m.PagesSection })),
);
const UsersSection = dynamic(() =>
  import("@/components/settings/users-section").then((m) => ({ default: m.UsersSection })),
);
const MenuSection = dynamic(() =>
  import("@/components/settings/menu-section").then((m) => ({ default: m.MenuSection })),
);
const ActivitySection = dynamic(() =>
  import("@/components/settings/activity-section").then((m) => ({ default: m.ActivitySection })),
);
const BackupSection = dynamic(() =>
  import("@/components/settings/backup-section").then((m) => ({ default: m.BackupSection })),
);

type SectionKey =
  | "account" | "security" | "appearance" | "notifications"
  | "connections" | "pages" | "menu" | "users" | "activity" | "backup";

const ADMIN_SECTIONS = new Set<SectionKey>(["connections", "pages", "menu", "users", "activity", "backup"]);

const SECTION_MAP: Record<SectionKey, React.ComponentType> = {
  account: AccountSection,
  security: SecuritySection,
  appearance: AppearanceSection,
  notifications: NotificationsSection,
  connections: ConnectionsSection,
  pages: PagesSection,
  menu: MenuSection,
  users: UsersSection,
  activity: ActivitySection,
  backup: BackupSection,
};

function SectionFallback() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function SettingsModalInner({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const section = searchParams.get("settings") as SectionKey | null;

  const close = useCallback(() => {
    router.replace(pathname);
  }, [router, pathname]);

  useEffect(() => {
    if (!section) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [section, close]);

  if (!section) return null;

  const SectionComponent = SECTION_MAP[section];
  if (!SectionComponent) return null;
  if (ADMIN_SECTIONS.has(section) && !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/60" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative flex h-full w-full overflow-hidden bg-background shadow-lg ring-1 ring-border sm:h-[calc(100vh-4rem)] sm:max-w-[calc(100%-4rem)] sm:rounded-xl"
      >
        <aside className="flex w-48 shrink-0 flex-col gap-3 border-r bg-sidebar p-3 sm:w-60 sm:p-4">
          <h2 className="px-2 text-sm font-semibold text-sidebar-foreground">Settings</h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SettingsNav isAdmin={isAdmin} activeSection={section} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-end border-b px-3">
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
            <Suspense fallback={<SectionFallback />}>
              <SectionComponent />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Suspense>
      <SettingsModalInner isAdmin={isAdmin} />
    </Suspense>
  );
}
