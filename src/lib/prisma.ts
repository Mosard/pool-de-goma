import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Falls back to a placeholder so the client can be constructed (and pages that
// never touch the DB, like /login for an anonymous visitor, keep working) even
// before POSTGRES_URL is configured on the hosting platform.
const datasourceUrl =
  process.env.POSTGRES_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: datasourceUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
