import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError } from "@/lib/api/responses";
import { destroySession } from "@/lib/auth/session";
import { env } from "@/lib/validation/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroySession();

    const response = NextResponse.redirect(new URL("/", env.APP_BASE_URL), 303);

    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
