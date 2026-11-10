import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  OAUTH_COOKIE_TTL_SECONDS,
  OAUTH_EXPECTED_USER_COOKIE,
  OAUTH_MODE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
} from "@/lib/auth/constants";
import { safeEqual } from "@/lib/auth/crypto";
import { upsertGitHubIdentity } from "@/lib/auth/github-account";
import {
  exchangeGitHubCode,
  fetchGitHubEmails,
  fetchGitHubUser,
  isGitHubAuthConfigured,
  type GitHubEmail,
} from "@/lib/auth/github";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/validation/env";

export const dynamic = "force-dynamic";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function oauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/github",
    maxAge: OAUTH_COOKIE_TTL_SECONDS,
  };
}

function clearOAuthCookies(cookieStore: CookieStore): void {
  const options = { ...oauthCookieOptions(), maxAge: 0 };

  for (const name of [
    OAUTH_STATE_COOKIE,
    OAUTH_VERIFIER_COOKIE,
    OAUTH_MODE_COOKIE,
    OAUTH_EXPECTED_USER_COOKIE,
  ]) {
    cookieStore.set(name, "", options);
  }
}

function redirectTo(path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, env.APP_BASE_URL), 302);

  response.headers.set("Cache-Control", "no-store");

  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();

  const clearAndRedirect = (path: string) => {
    clearOAuthCookies(cookieStore);
    return redirectTo(path);
  };

  if (!isGitHubAuthConfigured()) {
    return clearAndRedirect("/?auth=not-configured");
  }

  const oauthError = requestUrl.searchParams.get("error");

  if (oauthError) {
    return clearAndRedirect(`/?auth=error&reason=${encodeURIComponent(oauthError)}`);
  }

  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(OAUTH_VERIFIER_COOKIE)?.value;
  const mode = cookieStore.get(OAUTH_MODE_COOKIE)?.value === "reconnect" ? "reconnect" : "signin";
  const expectedUser = cookieStore.get(OAUTH_EXPECTED_USER_COOKIE)?.value;

  if (!code) {
    return clearAndRedirect("/?auth=error&reason=missing-code");
  }

  if (!state || !expectedState || !safeEqual(state, expectedState)) {
    return clearAndRedirect("/?auth=error&reason=state");
  }

  if (!verifier) {
    return clearAndRedirect("/?auth=error&reason=verifier");
  }

  try {
    const token = await exchangeGitHubCode(code, verifier);
    const githubUser = await fetchGitHubUser(token.access_token);

    if (expectedUser && expectedUser !== String(githubUser.id)) {
      return clearAndRedirect("/?auth=error&reason=account-mismatch");
    }

    let emails: GitHubEmail[] = [];

    try {
      emails = await fetchGitHubEmails(token.access_token);
    } catch {
      emails = [];
    }

    const { user } = await upsertGitHubIdentity(prisma, {
      githubUser,
      emails,
      token,
    });

    await createSession(user.id);

    clearOAuthCookies(cookieStore);

    if (mode === "reconnect") {
      return redirectTo("/admin?github=reconnected");
    }

    if (!user.onboardingCompletedAt) {
      return redirectTo("/onboarding");
    }

    return redirectTo("/dashboard");
  } catch (error) {
    console.error(
      "[auth] GitHub callback failed",
      error instanceof Error ? error.name : "unknown error",
    );

    return clearAndRedirect("/?auth=error&reason=oauth");
  }
}
