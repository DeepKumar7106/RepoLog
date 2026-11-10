import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, readJson, requireApiTenant } from "@/lib/api/responses";
import { onboardingSchema } from "@/lib/validation/schemas";
import { toUserProfileDto } from "@/server/dto/user-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const body = onboardingSchema.parse(await readJson(request));
    const user = await services.userProfile.completeOnboarding(tenant, body);

    return NextResponse.json({ data: toUserProfileDto(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
