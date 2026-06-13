import Link from "next/link";
import { LayoutDashboard, Plug, Users } from "lucide-react";

import { getWorkspaceContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DynamicIcon } from "@/lib/icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardHome() {
  const ctx = await getWorkspaceContext();
  const where = { workspaceId: ctx.workspaceId };
  const [pageCount, connectionCount, memberCount, pages] = await Promise.all([
    prisma.page.count({ where }),
    prisma.apiConnection.count({ where }),
    prisma.membership.count({ where }),
    prisma.page.findMany({
      where,
      select: { id: true, name: true, slug: true, icon: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const stats = [
    { label: "Pages", value: pageCount, icon: LayoutDashboard },
    { label: "API Connections", value: connectionCount, icon: Plug },
    { label: "Members", value: memberCount, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="gradient-accent overflow-hidden rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {ctx.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s an overview of your workspace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>Jump straight into your pages.</CardDescription>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <div className="gradient-accent flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg bg-card text-muted-foreground ring-1 ring-border">
                <LayoutDashboard className="size-5" />
              </div>
              <p className="text-sm font-medium">No pages yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Create your first page in Settings → Pages to start building.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pages.map((page) => (
                <Link
                  key={page.id}
                  href={`/dashboard/p/${page.slug}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/15 hover:bg-accent"
                >
                  <DynamicIcon
                    name={page.icon}
                    className="size-5 text-muted-foreground"
                  />
                  <span className="font-medium">{page.name}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
