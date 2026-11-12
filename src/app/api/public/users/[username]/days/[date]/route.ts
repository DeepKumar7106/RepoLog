import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api/responses";
import { dateParamSchema, slugSchema } from "@/lib/validation/schemas";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ username: string; date: string }> },
) {
  try {
    const { username, date } = await context.params;
    const day = dateParamSchema.parse(date);
    const projectParam = new URL(request.url).searchParams.get("project");
    const project = projectParam ? slugSchema.parse(projectParam) : undefined;
    const detail = await services.publicProfiles.getDay(username, day, {
      projectSlug: project,
    });

    if (!detail) {
      return apiError("NOT_FOUND", "Profile or project not found", 404);
    }

    return NextResponse.json({ data: detail });
  } catch (error) {
    return handleApiError(error);
  }
}
