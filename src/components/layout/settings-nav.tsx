"use client";

import Link from "next/link";

import { DynamicIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface NavItem {
  key: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GENERAL: NavGroup = {
  label: "General",
  items: [
    { key: "account", label: "Account", icon: "user" },
    { key: "security", label: "Security", icon: "shield" },
    { key: "notifications", label: "Notifications", icon: "bell" },
    { key: "appearance", label: "Appearance", icon: "palette" },
  ],
};

const DASHBOARD: NavGroup = {
  label: "Dashboard",
  items: [
    { key: "connections", label: "Connections", icon: "plug" },
    { key: "pages", label: "Pages", icon: "layout-dashboard" },
    { key: "menu", label: "Menu", icon: "list-tree" },
    { key: "users", label: "Users", icon: "users" },
    { key: "activity", label: "Activity", icon: "history" },
    { key: "backup", label: "Backup", icon: "database-backup" },
  ],
};

export function SettingsNav({
  isAdmin,
  activeSection,
}: {
  isAdmin: boolean;
  activeSection: string;
}) {
  const groups = isAdmin ? [GENERAL, DASHBOARD] : [GENERAL];

  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-2 text-xs font-medium text-sidebar-foreground/70">{group.label}</p>
          {group.items.map((item) => (
            <Link
              key={item.key}
              href={`?settings=${item.key}`}
              replace
              className={cn(
                "flex w-full items-center gap-2 rounded-md p-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                activeSection === item.key &&
                  "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-soft ring-1 ring-sidebar-border",
              )}
            >
              <DynamicIcon name={item.icon} className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
