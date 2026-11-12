import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api/responses";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string; slug: string }> },
) {
  try {
    const { username, slug } = await context.params;
    const project = await services.publicProfiles.findProjectBySlugs(username, slug);

    if (!project) {
      return apiError("NOT_FOUND", "Project not found", 404);
    }

    return NextResponse.json({ data: project });
  } catch (error) {
    return handleApiError(error);
  }
}
