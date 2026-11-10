import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, requireApiTenant } from "@/lib/api/responses";
import { disconnectGitHub, GitHubNotConnectedError } from "@/lib/auth/github-account";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/validation/env";

export const dynamic = "force-dynamic";

function redirectTo(path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, env.APP_BASE_URL), 303);

  response.headers.set("Cache-Control", "no-store");

  return response;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const tenant = await requireApiTenant();

    await disconnectGitHub(prisma, tenant);

    return redirectTo("/admin?github=disconnected");
  } catch (error) {
    if (error instanceof GitHubNotConnectedError) {
      return redirectTo("/admin?github=not-connected");
    }

    return handleApiError(error);
  }
}
