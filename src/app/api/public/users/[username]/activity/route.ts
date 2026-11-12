import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api/responses";
import { publicActivityQuerySchema } from "@/lib/validation/schemas";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

function readQuery(request: Request): Record<string, string> {
  const query: Record<string, string> = {};
  const searchParams = new URL(request.url).searchParams;

  for (const key of ["from", "to", "project"]) {
    const value = searchParams.get(key);

    if (value !== null && value !== "") {
      query[key] = value;
    }
  }

  return query;
}

export async function GET(request: Request, context: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await context.params;
    const query = publicActivityQuerySchema.parse(readQuery(request));
    const activity = await services.publicProfiles.getActivity(username, {
      from: query.from,
      to: query.to,
      projectSlug: query.project,
    });

    if (!activity) {
      return apiError("NOT_FOUND", "Profile or project not found", 404);
    }

    return NextResponse.json({ data: activity });
  } catch (error) {
    return handleApiError(error);
  }
}
