import { execSync } from "node:child_process";
import { getTestDatabaseUrl } from "./support/env";
import { getE2EPrisma, resetE2EDatabase } from "./support/db";

export default async function globalSetup(): Promise<void> {
  const databaseUrl = getTestDatabaseUrl();

  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: "inherit",
  });

  const prisma = getE2EPrisma();

  try {
    await resetE2EDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
