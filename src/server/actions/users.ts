"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  logConfigChange,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/guard";

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "VIEWER"]),
  isActive: z.boolean(),
  /** Required on create; on edit, blank = keep current password. */
  password: z.string().optional(),
});

export type UserInput = z.infer<typeof userSchema>;

export async function saveUser(input: UserInput): Promise<ActionResult> {
  return runAction(async () => {
    // Only super admins manage users (and grant roles).
    const session = await requireRole("SUPER_ADMIN");
    const data = userSchema.parse(input);

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing && existing.id !== data.id) {
      throw new Error("A user with this email already exists");
    }

    if (data.id) {
      if (data.id === session.user.id && data.role !== "SUPER_ADMIN") {
        throw new Error("You can't demote your own account");
      }
      await prisma.user.update({
        where: { id: data.id },
        data: {
          name: data.name,
          email: data.email,
          role: data.role,
          isActive: data.isActive,
          ...(data.password && {
            passwordHash: await bcrypt.hash(data.password, 10),
          }),
        },
      });
    } else {
      if (!data.password || data.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          role: data.role,
          isActive: data.isActive,
          passwordHash: await bcrypt.hash(data.password, 10),
        },
      });
    }

    await logConfigChange(session.user.id, {
      entity: "user",
      email: data.email,
      op: data.id ? "update" : "create",
    });
    revalidatePath("/dashboard/settings/users");
  });
}

export async function deleteUser(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("SUPER_ADMIN");
    if (id === session.user.id) {
      throw new Error("You can't delete your own account");
    }
    const deleted = await prisma.user.delete({ where: { id } });
    await logConfigChange(session.user.id, {
      entity: "user",
      email: deleted.email,
      op: "delete",
    });
    revalidatePath("/dashboard/settings/users");
  });
}

export async function getSessionRole() {
  const session = await auth();
  return session?.user.role ?? null;
}
