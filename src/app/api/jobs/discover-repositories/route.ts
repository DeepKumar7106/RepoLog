import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/api/job-auth";
import { apiError } from "@/lib/api/responses";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
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
  const limit = positiveInt(url.searchParams.get("limit"), 10, 50);
  const intervalHours = positiveInt(url.searchParams.get("intervalHours"), 24, 168);
  const users = await services.repositoryDiscovery.listDueUsers({ limit, intervalHours });
  const results = [];

  for (const user of users) {
    const tenant = createTenantContext(user.userId);

    try {
      const accessToken = await services.githubConnection.getAccessToken(tenant);
      const result = await services.repositoryDiscovery.discover(tenant, accessToken, {
        trigger: "SCHEDULED",
      });

      results.push({
        userId: user.userId,
        status: "succeeded",
        discovered: result.discovered,
        created: result.created,
        updated: result.updated,
      });
    } catch {
      logWarn("discovery.user_failed", { requestId, userId: user.userId });
      results.push({
        userId: user.userId,
        status: "failed",
        error: "Repository discovery failed",
      });
    }
  }

  logInfo("discovery.completed", {
    requestId,
    processed: results.length,
    failed: results.filter((result) => result.status === "failed").length,
  });

  return NextResponse.json({
    data: {
      processed: results.length,
      results,
    },
  });
}
