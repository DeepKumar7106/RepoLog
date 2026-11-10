import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, requireApiTenant } from "@/lib/api/responses";
import { idParamSchema } from "@/lib/validation/schemas";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const { id } = await context.params;
    const repositoryId = idParamSchema.parse(id);
    const accessToken = await services.githubConnection.getAccessToken(tenant);
    const result = await services.repositorySync.sync(tenant, repositoryId, accessToken);

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
