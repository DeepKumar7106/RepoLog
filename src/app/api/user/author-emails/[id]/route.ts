import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, readJson, requireApiTenant } from "@/lib/api/responses";
import { idParamSchema, updateAuthorEmailSchema } from "@/lib/validation/schemas";
import { toAuthorEmailDto } from "@/server/dto/author-email-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const { id } = await context.params;
    const emailId = idParamSchema.parse(id);
    const body = updateAuthorEmailSchema.parse(await readJson(request));
    const email = await services.authorEmails.update(tenant, emailId, body.verifiedByUser);

    return NextResponse.json({ data: toAuthorEmailDto(email) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const { id } = await context.params;
    const emailId = idParamSchema.parse(id);
    await services.authorEmails.remove(tenant, emailId);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
