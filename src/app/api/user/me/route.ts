import { NextResponse } from "next/server";
import { handleApiError, requireApiTenant } from "@/lib/api/responses";
import { services } from "@/server/services";
import { toUserProfileDto } from "@/server/dto/user-dto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await requireApiTenant();
    const user = await services.userProfile.get(tenant);

    return NextResponse.json({ data: toUserProfileDto(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
