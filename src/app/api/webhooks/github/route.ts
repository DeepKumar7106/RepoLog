import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/responses";
import { verifyGitHubWebhookSignature } from "@/lib/github/webhooks";
import { logError, logInfo } from "@/lib/observability/logger";
import { env } from "@/lib/validation/env";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const secret = env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    return apiError("INTERNAL_ERROR", "GitHub webhook handling is not configured", 503);
  }

  const rawBody = await request.text();

  if (!verifyGitHubWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), secret)) {
    return apiError("FORBIDDEN", "Invalid GitHub webhook signature", 401);
  }

  const deliveryId = request.headers.get("x-github-delivery");
  const event = request.headers.get("x-github-event");

  if (!deliveryId || !event) {
    return apiError("VALIDATION_ERROR", "Missing GitHub webhook headers", 400);
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return apiError("VALIDATION_ERROR", "Webhook payload must be valid JSON", 400);
  }

  try {
    const result = await services.webhooks.handle({
      deliveryId,
      event,
      payload,
    });

    logInfo("webhook.processed", {
      requestId,
      deliveryId,
      event,
      status: result.status,
      connections: result.connections,
      enqueued: result.enqueued,
    });

    return NextResponse.json(
      { data: result },
      { status: result.status === "duplicate" ? 200 : 202 },
    );
  } catch (error) {
    logError("webhook.failed", {
      requestId,
      deliveryId,
      event,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return apiError("INTERNAL_ERROR", "Webhook processing failed", 500);
  }
}
