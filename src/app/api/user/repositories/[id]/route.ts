import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, readJson, requireApiTenant } from "@/lib/api/responses";
import { idParamSchema, updateUserRepositorySchema } from "@/lib/validation/schemas";
import { toUserRepositoryDto } from "@/server/dto/user-repository-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const { id } = await context.params;
    const repositoryId = idParamSchema.parse(id);
    const body = updateUserRepositorySchema.parse(await readJson(request));
    const record = await services.userRepositories.update(tenant, repositoryId, body);

    if (body.trackingEnabled) {
      await services.projects.ensureForUserRepository(tenant, repositoryId);
    }

    return NextResponse.json({ data: toUserRepositoryDto(record) });
  } catch (error) {
    return handleApiError(error);
  }
}
