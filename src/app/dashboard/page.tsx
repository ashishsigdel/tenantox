import Link from "next/link";
import { Database, Plug, Users } from "lucide-react";

import { auth } from "@/auth";
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
  const session = await auth();
  const [resourceCount, connectionCount, userCount, resources] =
    await Promise.all([
      prisma.resource.count(),
      prisma.apiConnection.count(),
      prisma.user.count(),
      prisma.resource.findMany({
        select: { id: true, name: true, slug: true, icon: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const stats = [
    { label: "Resources", value: resourceCount, icon: Database },
    { label: "API Connections", value: connectionCount, icon: Plug },
    { label: "Dashboard Users", value: userCount, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="gradient-accent overflow-hidden rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {session?.user.name?.split(" ")[0]}
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
          <CardTitle>Resources</CardTitle>
          <CardDescription>
            Jump straight into managing your data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <div className="gradient-accent flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg bg-card text-muted-foreground ring-1 ring-border">
                <Database className="size-5" />
              </div>
              <p className="text-sm font-medium">No resources yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Create your first resource in Settings → Resources to start
                managing data.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((resource) => (
                <Link
                  key={resource.id}
                  href={`/dashboard/r/${resource.slug}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/15 hover:bg-accent"
                >
                  <DynamicIcon
                    name={resource.icon}
                    className="size-5 text-muted-foreground"
                  />
                  <span className="font-medium">{resource.name}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
