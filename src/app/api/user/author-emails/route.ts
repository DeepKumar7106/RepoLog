import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, readJson, requireApiTenant } from "@/lib/api/responses";
import { authorEmailSchema } from "@/lib/validation/schemas";
import { toAuthorEmailDto } from "@/server/dto/author-email-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await requireApiTenant();
    const emails = await services.authorEmails.list(tenant);

    return NextResponse.json({ data: emails.map(toAuthorEmailDto) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const body = authorEmailSchema.parse(await readJson(request));
    const email = await services.authorEmails.add(tenant, body.email, body.verifiedByUser ?? true);

    return NextResponse.json({ data: toAuthorEmailDto(email) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
