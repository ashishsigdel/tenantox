"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireRole, runAction, type ActionResult } from "@/server/guard";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** Updates the signed-in user's own profile. */
export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("VIEWER");
    const data = profileSchema.parse(input);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: data.name },
    });
    revalidatePath("/dashboard/settings/account");
  });
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type PasswordInput = z.infer<typeof passwordSchema>;

/** Changes the signed-in user's own password. */
export async function changePassword(
  input: PasswordInput,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireRole("VIEWER");
    const data = passwordSchema.parse(input);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) throw new Error("Account not found");

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) throw new Error("Current password is incorrect");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(data.newPassword, 10) },
    });
  });
}
