import { expect, test } from "@playwright/test";
import { getE2EPrisma, resetE2EDatabase, seedE2EProfile } from "./support/db";

const prisma = getE2EPrisma();

test.beforeEach(async () => {
  await resetE2EDatabase(prisma);
  await seedE2EProfile(prisma);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("serves a public profile and project without authentication", async ({ page }) => {
  await page.goto("/u/e2e-public");

  await expect(page.getByRole("heading", { name: "E2E Public" })).toBeVisible();
  await expect(page.getByText("E2E public profile bio")).toBeVisible();
  await expect(page.getByText(/1 qualifying commits/)).toBeVisible();

  await page.getByRole("link", { name: "E2E Project" }).click();

  await expect(page).toHaveURL(/\/u\/e2e-public\/projects\/e2e-project$/);
  await expect(page.getByRole("heading", { name: "E2E Project", exact: true })).toBeVisible();
  await expect(page.getByText("A public end-to-end project")).toBeVisible();
  await expect(page.getByText("Public README content.")).toBeVisible();
});

test("does not expose a private profile", async ({ page }) => {
  const response = await page.goto("/u/e2e-private");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("E2E Private")).toHaveCount(0);
});
