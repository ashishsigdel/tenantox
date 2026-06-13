"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  logConfigChange,
  requireWorkspaceRole,
  runAction,
  type ActionResult,
} from "@/server/guard";

const ROLE = z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "VIEWER"]);

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

/** Members of the active workspace. */
export async function listMembers(): Promise<MemberRow[]> {
  const { workspaceId } = await requireWorkspaceRole("ADMIN");
  const memberships = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    joinedAt: m.createdAt.toISOString(),
  }));
}

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: ROLE,
});

/**
 * Adds an existing registered user to the active workspace. (Email invitations
 * for users without an account are a later phase.)
 */
export async function addMember(input: {
  email: string;
  role: z.infer<typeof ROLE>;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("ADMIN");
    const data = inviteSchema.parse(input);
    const email = data.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error(
        "No account with that email. Ask them to sign up first, then add them.",
      );
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    });
    if (existing) throw new Error("They're already a member of this workspace");

    await prisma.membership.create({
      data: { userId: user.id, workspaceId, role: data.role },
    });
    await logConfigChange(userId, workspaceId, {
      entity: "member",
      email,
      op: "add",
    });
    revalidatePath("/dashboard/settings/users");
  });
}

const roleSchema = z.object({
  targetUserId: z.string().min(1),
  role: ROLE,
});

/** Changes a member's role within the active workspace. */
export async function updateMemberRole(input: {
  targetUserId: string;
  role: z.infer<typeof ROLE>;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("SUPER_ADMIN");
    const data = roleSchema.parse(input);

    if (data.targetUserId === userId && data.role !== "SUPER_ADMIN") {
      await assertNotLastOwner(workspaceId, userId);
    }

    const result = await prisma.membership.updateMany({
      where: { userId: data.targetUserId, workspaceId },
      data: { role: data.role },
    });
    if (result.count === 0) throw new Error("Member not found");

    await logConfigChange(userId, workspaceId, {
      entity: "member",
      targetUserId: data.targetUserId,
      op: "role",
    });
    revalidatePath("/dashboard/settings/users");
  });
}

/** Removes a member from the active workspace. */
export async function removeMember(targetUserId: string): Promise<ActionResult> {
  return runAction(async () => {
    const { userId, workspaceId } = await requireWorkspaceRole("ADMIN");
    if (targetUserId === userId) {
      await assertNotLastOwner(workspaceId, userId);
    }
    const result = await prisma.membership.deleteMany({
      where: { userId: targetUserId, workspaceId },
    });
    if (result.count === 0) throw new Error("Member not found");

    await logConfigChange(userId, workspaceId, {
      entity: "member",
      targetUserId,
      op: "remove",
    });
    revalidatePath("/dashboard/settings/users");
  });
}

/** Guards against a workspace losing its last owner. */
async function assertNotLastOwner(workspaceId: string, userId: string) {
  const owners = await prisma.membership.count({
    where: { workspaceId, role: "SUPER_ADMIN" },
  });
  const isOwner = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  if (isOwner?.role === "SUPER_ADMIN" && owners <= 1) {
    throw new Error("A workspace must keep at least one owner");
  }
}
