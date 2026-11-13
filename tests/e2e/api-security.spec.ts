import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { E2E_JOB_SECRET, E2E_WEBHOOK_SECRET } from "./support/env";

test("rejects job requests without the bearer secret", async ({ request }) => {
  const response = await request.post("/api/jobs/sync-repositories?mode=process");

  expect(response.status()).toBe(401);
});

test("accepts job requests with the bearer secret", async ({ request }) => {
  const response = await request.post("/api/jobs/sync-repositories?mode=process", {
    headers: {
      authorization: `Bearer ${E2E_JOB_SECRET}`,
    },
  });

  expect(response.status()).toBe(200);
});

test("rejects webhook requests with an invalid signature", async ({ request }) => {
  const response = await request.post("/api/webhooks/github", {
    data: {},
    headers: {
      "x-github-delivery": "e2e-invalid-signature",
      "x-github-event": "push",
      "x-hub-signature-256": "sha256=invalid",
    },
  });

  expect(response.status()).toBe(401);
});

test("accepts a correctly signed ping webhook", async ({ request }) => {
  const body = JSON.stringify({ zen: "E2E ping", hook_id: 1 });
  const signature = createHmac("sha256", E2E_WEBHOOK_SECRET).update(body, "utf8").digest("hex");
  const response = await request.post("/api/webhooks/github", {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-github-delivery": "e2e-ping",
      "x-github-event": "ping",
      "x-hub-signature-256": `sha256=${signature}`,
    },
  });

  expect(response.status()).toBe(202);
  await expect(response).toBeOK();
  expect((await response.json()).data.status).toBe("ignored");
});
