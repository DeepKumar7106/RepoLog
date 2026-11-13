import { expect, test } from "@playwright/test";

test("redirects an unauthenticated dashboard request to sign-in", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/\?auth=required$/);
  await expect(
    page.getByText("Sign in with GitHub to access your private workspace."),
  ).toBeVisible();
});
