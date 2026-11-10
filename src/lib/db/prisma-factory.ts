import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Builds a Prisma client for an explicit connection string.
 *
 * Keeping the factory independent of the validated application environment
 * lets tests and scripts create clients for separate databases without
 * mutating process-wide state.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  if (!connectionString) {
    throw new Error("A PostgreSQL connection string is required");
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

export type AppPrismaClient = PrismaClient;
