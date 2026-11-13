import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.test", override: true });

export const E2E_BASE_URL = "http://localhost:3100";
export const E2E_SESSION_COOKIE = "reporlog_session";
export const E2E_JOB_SECRET = "e2e-job-secret-0123456789abcdef0123456789";
export const E2E_WEBHOOK_SECRET = "e2e-webhook-secret-0123456789abcdef0123456789";

export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error("TEST_DATABASE_URL is required to run Playwright end-to-end tests");
  }

  return url;
}
