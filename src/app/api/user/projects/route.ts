import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, readJson, requireApiTenant } from "@/lib/api/responses";
import { createProjectSchema } from "@/lib/validation/schemas";
import { toProjectDto } from "@/server/dto/project-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await requireApiTenant();
    const projects = await services.projects.list(tenant);

    return NextResponse.json({ data: projects.map(toProjectDto) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const body = createProjectSchema.parse(await readJson(request));
    const project = await services.projects.ensureForUserRepository(tenant, body.userRepositoryId);

    return NextResponse.json({ data: toProjectDto(project) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
