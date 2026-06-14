import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// In serverless (Vercel), each cold start creates a new process. Limiting to
// 1 connection per instance prevents exhausting the database's connection cap.
// In development the global singleton is reused across hot reloads instead.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.NODE_ENV === "production"
            ? `${process.env.DATABASE_URL}?connection_limit=1&pool_timeout=0`
            : process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
