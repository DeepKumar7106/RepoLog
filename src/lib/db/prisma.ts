import { createPrismaClient, type AppPrismaClient } from "@/lib/db/prisma-factory";
import { env } from "@/lib/validation/env";

const globalForPrisma = globalThis as unknown as {
  __reporlogPrisma?: AppPrismaClient;
};

export const prisma = globalForPrisma.__reporlogPrisma ?? createPrismaClient(env.DATABASE_URL);

if (env.NODE_ENV !== "production") {
  globalForPrisma.__reporlogPrisma = prisma;
}
