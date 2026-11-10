import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, requireApiTenant } from "@/lib/api/responses";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const accessToken = await services.githubConnection.getAccessToken(tenant);
    const result = await services.repositoryDiscovery.discover(tenant, accessToken);

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
