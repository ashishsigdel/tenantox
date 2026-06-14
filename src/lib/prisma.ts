import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// In serverless (Vercel), each cold start creates a new process. Limiting to
// 1 connection per instance prevents exhausting the database's connection cap.
// In development the global singleton is reused across hot reloads instead.
function databaseUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base || process.env.NODE_ENV !== "production") return base;
  // The URL may already carry a query string (e.g. ?sslmode=require on Aiven,
  // or ?schema=public). Appending a literal "?" would produce a second "?" and
  // fold our params into the previous one (e.g. schema becomes
  // "public?connection_limit=1"), breaking every query — so pick the separator.
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}connection_limit=1&pool_timeout=0`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
