import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Workspace the user is currently acting in; null = no membership. */
      activeWorkspaceId: string | null;
      /** Role within the active workspace; null = no membership. */
      role: Role | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    activeWorkspaceId: string | null;
    role: Role | null;
  }
}
