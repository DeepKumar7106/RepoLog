import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/validation/env";

/**
 * Internal job endpoints use a bearer secret and never accept a tenant id from
 * the caller. Milestone 4+ job handlers resolve tenant ownership from stored
 * records.
 */
export function isAuthorizedJobRequest(request: Request): boolean {
  const secret = env.JOB_SECRET;

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

  const provided = Buffer.from(token);
  const expected = Buffer.from(secret);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
