import { defineConfig } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_JOB_SECRET,
  E2E_WEBHOOK_SECRET,
  getTestDatabaseUrl,
} from "./tests/e2e/support/env";

const serverEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const browserChannel = process.env.PLAYWRIGHT_CHANNEL || "chrome";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    channel: browserChannel === "chromium" ? undefined : browserChannel,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/e2e/start-server.mjs",
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...serverEnvironment,
      DATABASE_URL: getTestDatabaseUrl(),
      APP_BASE_URL: E2E_BASE_URL,
      NEXT_DIST_DIR: ".next-e2e",
      JOB_SECRET: E2E_JOB_SECRET,
      GITHUB_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET,
    },
  },
});
