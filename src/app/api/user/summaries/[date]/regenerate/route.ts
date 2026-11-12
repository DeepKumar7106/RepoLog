import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, requireApiTenant } from "@/lib/api/responses";
import { dateParamSchema } from "@/lib/validation/schemas";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ date: string }> }) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const { date } = await context.params;
    const summaryDate = dateParamSchema.parse(date);
    const scope = new URL(request.url).searchParams.get("scope");
    const result = await services.summaries.generateForDate(tenant, summaryDate, {
      force: true,
      scopes: scope === "PUBLIC" || scope === "PRIVATE" ? [scope] : undefined,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
