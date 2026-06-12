"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings2 } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { DynamicIcon } from "@/lib/icons";
import type { MenuNode } from "@/lib/menu";

interface SettingsLink {
  label: string;
  href: string;
  icon: string;
}

export function AppSidebar({
  menu,
  settingsLinks,
}: {
  menu: MenuNode[];
  settingsLinks: SettingsLink[];
}) {
  const pathname = usePathname();
  const isActive = (href: string | null) =>
    !!href &&
    (href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href));

  function renderLeaf(node: MenuNode) {
    if (node.type === "DIVIDER") {
      return <SidebarSeparator key={node.id} className="my-1" />;
    }
    return (
      <SidebarMenuItem key={node.id}>
        <SidebarMenuButton asChild isActive={isActive(node.href)}>
          <Link href={node.href ?? "#"}>
            <DynamicIcon name={node.icon} />
            <span>{node.label}</span>
          </Link>
        </SidebarMenuButton>
        {node.children.length > 0 && (
          <SidebarMenuSub>
            {node.children.map((child) => (
              <SidebarMenuSubItem key={child.id}>
                <SidebarMenuSubButton asChild isActive={isActive(child.href)}>
                  <Link href={child.href ?? "#"}>
                    <span>{child.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    );
  }

  // Top-level non-group items render in an unlabeled group at the top.
  const looseItems = menu.filter((n) => n.type !== "GROUP");
  const groups = menu.filter((n) => n.type === "GROUP");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <span className="font-semibold">Admin Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {looseItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>{looseItems.map(renderLeaf)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{group.children.map(renderLeaf)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {settingsLinks.length > 0 && (
        <SidebarFooter>
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1">
              <Settings2 className="size-3" /> Settings
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsLinks.map((link) => (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton asChild isActive={isActive(link.href)}>
                      <Link href={link.href}>
                        <DynamicIcon name={link.icon} />
                        <span>{link.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
