import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Resolves which workspace a user is active in. When `preferredId` is given and
 * the user is a member, it wins; otherwise we fall back to their oldest
 * membership. Returns null when the user belongs to no workspace.
 */
async function resolveWorkspace(
  userId: string,
  preferredId?: string,
): Promise<{ workspaceId: string; role: Role } | null> {
  if (preferredId) {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: preferredId } },
    });
    if (membership)
      return { workspaceId: membership.workspaceId, role: membership.role };
  }
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return membership
    ? { workspaceId: membership.workspaceId, role: membership.role }
    : null;
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: updateSession,
} = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in: seed the active workspace from the user's memberships.
      if (user) {
        token.id = user.id as string;
        const ws = await resolveWorkspace(user.id as string);
        token.activeWorkspaceId = ws?.workspaceId ?? null;
        token.role = ws?.role ?? null;
      }
      // Workspace switch: client calls useSession().update({ activeWorkspaceId }).
      // Membership is re-verified here server-side — the JWT is never trusted.
      if (
        trigger === "update" &&
        session &&
        typeof (session as { activeWorkspaceId?: unknown }).activeWorkspaceId ===
          "string"
      ) {
        const ws = await resolveWorkspace(
          token.id as string,
          (session as { activeWorkspaceId: string }).activeWorkspaceId,
        );
        if (ws) {
          token.activeWorkspaceId = ws.workspaceId;
          token.role = ws.role;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.activeWorkspaceId =
        (token.activeWorkspaceId as string | null) ?? null;
      session.user.role = (token.role as Role | null) ?? null;
      return session;
    },
  },
});
