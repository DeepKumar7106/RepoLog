import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGitHubWebhookSignature } from "@/lib/github/webhooks";

const secret = "a".repeat(32);
const body = JSON.stringify({ action: "opened" });

function signatureFor(value: string, signingSecret = secret): string {
  return `sha256=${createHmac("sha256", signingSecret).update(value).digest("hex")}`;
}

describe("GitHub webhook signatures", () => {
  it("accepts a valid sha256 signature", () => {
    expect(verifyGitHubWebhookSignature(body, signatureFor(body), secret)).toBe(true);
  });

  it("rejects a modified body, wrong secret and malformed signature", () => {
    expect(verifyGitHubWebhookSignature(`${body} `, signatureFor(body), secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(body, signatureFor(body, "b".repeat(32)), secret)).toBe(
      false,
    );
    expect(verifyGitHubWebhookSignature(body, "sha1=abc", secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(body, signatureFor(body), "")).toBe(false);
  });
});
