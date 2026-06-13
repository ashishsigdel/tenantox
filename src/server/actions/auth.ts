"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { runAction, type ActionResult } from "@/server/guard";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  workspaceName: z.string().min(1).max(80).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Self-service signup: creates the user, their personal workspace, and an
 * owner (SUPER_ADMIN) membership in one transaction. The client signs in after.
 */
export async function registerUser(input: RegisterInput): Promise<ActionResult> {
  return runAction(async () => {
    const data = registerSchema.parse(input);
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error("An account with this email already exists");
    }

    const wsName = data.workspaceName?.trim() || `${data.name}'s workspace`;
    const slug = await uniqueSlug(
      data.workspaceName?.trim() || data.name,
      async (candidate) =>
        (await prisma.workspace.count({ where: { slug: candidate } })) > 0,
    );

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name: data.name, passwordHash },
      });
      const workspace = await tx.workspace.create({
        data: { name: wsName, slug },
      });
      await tx.membership.create({
        data: {
          userId: created.id,
          workspaceId: workspace.id,
          role: "SUPER_ADMIN",
        },
      });
      return created;
    });

    return { id: user.id };
  });
}
