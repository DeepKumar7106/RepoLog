import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/api/job-auth";
import { apiError } from "@/lib/api/responses";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return apiError("UNAUTHENTICATED", "A valid job secret is required", 401);
  }

  const users = await services.summaries.listEnabledUsers();
  const results = [];

  for (const user of users) {
    const tenant = createTenantContext(user.userId);
    const date = services.summaries.yesterdayFor(user.user.timezone);

    try {
      const result = await services.summaries.generateForDate(tenant, date);
      results.push({
        userId: user.userId,
        date: result.date,
        timezone: result.timezone,
        summaries: result.summaries.map((summary) => ({
          scope: summary.scope,
          status: summary.status,
          reason: summary.reason,
        })),
      });
    } catch {
      results.push({
        userId: user.userId,
        date,
        timezone: user.user.timezone,
        error: "Summary generation failed",
      });
    }
  }

  return NextResponse.json({
    data: {
      processed: results.length,
      results,
    },
  });
}
