import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, readJson, requireApiTenant } from "@/lib/api/responses";
import { updateSettingsSchema } from "@/lib/validation/schemas";
import { toUserSettingsDto } from "@/server/dto/user-settings-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await requireApiTenant();
    const settings = await services.userSettings.get(tenant);

    return NextResponse.json({ data: toUserSettingsDto(settings) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const body = updateSettingsSchema.parse(await readJson(request));
    const settings = await services.userSettings.update(tenant, body);

    return NextResponse.json({ data: toUserSettingsDto(settings) });
  } catch (error) {
    return handleApiError(error);
  }
}
