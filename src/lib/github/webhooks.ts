import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

export function verifyGitHubWebhookSignature(
  rawBody: string | Buffer,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature?.startsWith(SIGNATURE_PREFIX) || secret.length === 0) {
    return false;
  }

  const provided = Buffer.from(signature.slice(SIGNATURE_PREFIX.length), "hex");

  if (provided.length !== 32) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody)
    .digest();

  return timingSafeEqual(provided, expected);
}
