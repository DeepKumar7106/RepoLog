import { expect, test } from "@playwright/test";
import { createE2ESession, getE2EPrisma, resetE2EDatabase, seedE2EProfile } from "./support/db";
import { E2E_BASE_URL, E2E_SESSION_COOKIE } from "./support/env";

const prisma = getE2EPrisma();
let fixture: Awaited<ReturnType<typeof seedE2EProfile>>;

test.beforeEach(async () => {
  await resetE2EDatabase(prisma);
  fixture = await seedE2EProfile(prisma);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("renders the private dashboard for an authenticated user", async ({ page, context }) => {
  const token = await createE2ESession(prisma, fixture.user.id);

  await context.addCookies([
    {
      name: E2E_SESSION_COOKIE,
      value: token,
      url: E2E_BASE_URL,
    },
  ]);

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Welcome, E2E Public" })).toBeVisible();
  await expect(page.getByText("Tracked repositories", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E Project" })).toBeVisible();
  await expect(page.getByText("GitHub is disconnected.")).toBeVisible();
});
