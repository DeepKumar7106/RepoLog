import { execSync } from "node:child_process";
import { config } from "dotenv";

export default function globalSetup() {
  config({ path: ".env" });
  config({ path: ".env.test", override: true });

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    console.warn("[tests] TEST_DATABASE_URL is not set. Integration tests will be skipped.");
    return;
  }

  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
    },
    stdio: "inherit",
  });
}
