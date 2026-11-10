import { NextResponse } from "next/server";
import { handleApiError, requireApiTenant } from "@/lib/api/responses";
import { toSyncRunDto } from "@/server/dto/sync-run-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const tenant = await requireApiTenant();
    const limitParam = new URL(request.url).searchParams.get("limit");
    const parsedLimit = limitParam === null ? 50 : Number.parseInt(limitParam, 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 50;
    const syncRuns = await services.syncRuns.list(tenant, limit);

    return NextResponse.json({ data: syncRuns.map(toSyncRunDto) });
  } catch (error) {
    return handleApiError(error);
  }
}
