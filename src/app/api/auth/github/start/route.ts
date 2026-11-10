import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  OAUTH_COOKIE_TTL_SECONDS,
  OAUTH_EXPECTED_USER_COOKIE,
  OAUTH_MODE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
} from "@/lib/auth/constants";
import {
  codeChallengeFromVerifier,
  generateCodeVerifier,
  generateOAuthState,
} from "@/lib/auth/crypto";
import { buildGitHubAuthorizationUrl, isGitHubAuthConfigured } from "@/lib/auth/github";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/validation/env";

export const dynamic = "force-dynamic";

function oauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/github",
    maxAge: OAUTH_COOKIE_TTL_SECONDS,
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const mode = requestUrl.searchParams.get("mode") === "reconnect" ? "reconnect" : "signin";

  if (!isGitHubAuthConfigured()) {
    return NextResponse.redirect(new URL("/?auth=not-configured", env.APP_BASE_URL), 302);
  }

  const session = await getSession();

  if (mode === "signin" && session) {
    return NextResponse.redirect(new URL("/dashboard", env.APP_BASE_URL), 302);
  }

  if (mode === "reconnect" && !session) {
    return NextResponse.redirect(new URL("/?auth=required", env.APP_BASE_URL), 302);
  }

  const state = generateOAuthState();
  const verifier = generateCodeVerifier();
  const challenge = codeChallengeFromVerifier(verifier);
  const cookieStore = await cookies();
  const options = oauthCookieOptions();

  cookieStore.set(OAUTH_STATE_COOKIE, state, options);
  cookieStore.set(OAUTH_VERIFIER_COOKIE, verifier, options);
  cookieStore.set(OAUTH_MODE_COOKIE, mode, options);

  if (mode === "reconnect" && session) {
    cookieStore.set(OAUTH_EXPECTED_USER_COOKIE, session.githubUserId, options);
  }

  const response = NextResponse.redirect(buildGitHubAuthorizationUrl(state, challenge), 302);
  response.headers.set("Cache-Control", "no-store");

  return response;
}
