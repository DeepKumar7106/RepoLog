import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api/responses";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await context.params;
    const profile = await services.publicProfiles.findProfileBySlug(username);

    if (!profile) {
      return apiError("NOT_FOUND", "Profile not found", 404);
    }

    return NextResponse.json({ data: profile });
  } catch (error) {
    return handleApiError(error);
  }
}
