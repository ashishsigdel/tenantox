"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DynamicIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GENERAL: NavGroup = {
  label: "General",
  items: [
    { label: "Account", href: "/dashboard/settings/account", icon: "user" },
    { label: "Security", href: "/dashboard/settings/security", icon: "shield" },
    {
      label: "Notifications",
      href: "/dashboard/settings/notifications",
      icon: "bell",
    },
    {
      label: "Appearance",
      href: "/dashboard/settings/appearance",
      icon: "palette",
    },
  ],
};

const DASHBOARD: NavGroup = {
  label: "Dashboard",
  items: [
    {
      label: "Connections",
      href: "/dashboard/settings/connections",
      icon: "plug",
    },
    {
      label: "Pages",
      href: "/dashboard/settings/pages",
      icon: "layout-dashboard",
    },
    { label: "Menu", href: "/dashboard/settings/menu", icon: "list-tree" },
    { label: "Users", href: "/dashboard/settings/users", icon: "users" },
    { label: "Activity", href: "/dashboard/settings/activity", icon: "history" },
    {
      label: "Backup",
      href: "/dashboard/settings/backup",
      icon: "database-backup",
    },
  ],
};

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const groups = isAdmin ? [GENERAL, DASHBOARD] : [GENERAL];

  const isActive = (item: NavItem) =>
    pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-2 text-xs font-medium text-sidebar-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              replace
              className={cn(
                "flex w-full items-center gap-2 rounded-md p-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive(item) &&
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
