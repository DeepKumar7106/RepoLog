import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, readJson, requireApiTenant } from "@/lib/api/responses";
import { updateProfileSchema } from "@/lib/validation/schemas";
import { toUserProfileDto } from "@/server/dto/user-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const body = updateProfileSchema.parse(await readJson(request));
    const user = await services.userProfile.update(tenant, body);

    return NextResponse.json({ data: toUserProfileDto(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
