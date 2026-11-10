import { NextResponse } from "next/server";
import { handleApiError, requireApiTenant } from "@/lib/api/responses";
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
