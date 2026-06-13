"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import {
  ForbiddenError,
  requireWorkspaceRole,
  runAction,
  type ActionResult,
} from "@/server/guard";

/** Workspaces the current user belongs to, for the switcher. */
export async function listMyWorkspaces(): Promise<
  { id: string; name: string; slug: string; role: string }[]
> {
  const session = await auth();
  if (!session?.user) return [];
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { workspace: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
  }));
}

const createSchema = z.object({ name: z.string().min(1, "Name is required").max(80) });

/** Creates a new workspace owned by the current user. */
export async function createWorkspace(input: {
  name: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await auth();
    if (!session?.user) throw new ForbiddenError("Not authenticated");
    const { name } = createSchema.parse(input);

    const slug = await uniqueSlug(
      name,
      async (candidate) =>
        (await prisma.workspace.count({ where: { slug: candidate } })) > 0,
    );

    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({ data: { name, slug } });
      await tx.membership.create({
        data: { userId: session.user.id, workspaceId: ws.id, role: "SUPER_ADMIN" },
      });
      return ws;
    });

    return { id: workspace.id };
  });
}

const renameSchema = z.object({ name: z.string().min(1).max(80) });

/** Renames the active workspace (owner only). */
export async function renameWorkspace(input: {
  name: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { workspaceId } = await requireWorkspaceRole("SUPER_ADMIN");
    const { name } = renameSchema.parse(input);
    await prisma.workspace.update({ where: { id: workspaceId }, data: { name } });
  });
}
