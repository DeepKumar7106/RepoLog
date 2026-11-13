import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/api/job-auth";
import { apiError } from "@/lib/api/responses";
import { logInfo } from "@/lib/observability/logger";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

function positiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = value === null ? Number.NaN : Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return apiError("UNAUTHENTICATED", "A valid job secret is required", 401);
  }

  const requestId = randomUUID();
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "both";

  if (mode !== "both" && mode !== "enqueue" && mode !== "process") {
    return apiError("VALIDATION_ERROR", "mode must be enqueue, process or both", 400);
  }

  const limit = positiveInt(url.searchParams.get("limit"), 5, 25);
  const perUserLimit = positiveInt(url.searchParams.get("perUserLimit"), 2, 10);
  const maxPages = positiveInt(url.searchParams.get("maxPages"), 10, 100);
  const enqueue =
    mode === "enqueue" || mode === "both"
      ? await services.syncQueue.enqueueDueScheduledSyncs({
          limit: limit * perUserLimit,
          perUserLimit,
        })
      : null;
  const process =
    mode === "process" || mode === "both"
      ? await services.syncQueue.processPending({
          limit,
          perUserLimit,
          maxPages,
        })
      : null;

  logInfo("sync_job.completed", {
    requestId,
    mode,
    enqueued: enqueue?.enqueued ?? 0,
    processed: process?.processed ?? 0,
    retried: process?.retried ?? 0,
    failed: process?.failed ?? 0,
  });

  return NextResponse.json({
    data: {
      enqueue,
      process,
    },
  });
}
