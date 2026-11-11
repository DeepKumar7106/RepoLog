import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, readJson, requireApiTenant } from "@/lib/api/responses";
import { idParamSchema, updateProjectSchema } from "@/lib/validation/schemas";
import { toProjectDto } from "@/server/dto/project-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requireApiTenant();
    const { id } = await context.params;
    const project = await services.projects.get(tenant, idParamSchema.parse(id));

    return NextResponse.json({ data: toProjectDto(project) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const { id } = await context.params;
    const projectId = idParamSchema.parse(id);
    const body = updateProjectSchema.parse(await readJson(request));
    const project = await services.projects.update(tenant, projectId, body);

    return NextResponse.json({ data: toProjectDto(project) });
  } catch (error) {
    return handleApiError(error);
  }
}
