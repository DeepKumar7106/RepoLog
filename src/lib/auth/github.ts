import { z } from "zod";
import { DEFAULT_GITHUB_SCOPES } from "@/lib/auth/constants";
import { env } from "@/lib/validation/env";

const githubTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
});

const githubErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

const githubUserSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
  name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  html_url: z.string().url().optional(),
});

const githubEmailSchema = z.object({
  email: z.string().email(),
  primary: z.boolean().optional(),
  verified: z.boolean().optional(),
  visibility: z.string().nullable().optional(),
});

export type GitHubUser = z.infer<typeof githubUserSchema>;
export type GitHubEmail = z.infer<typeof githubEmailSchema>;
export type GitHubTokenResponse = z.infer<typeof githubTokenSchema>;

export class GitHubOAuthError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GitHubOAuthError";
    this.status = status;
  }
}

export class GitHubApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

export function isGitHubAuthConfigured(): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.AUTH_SECRET);
}

export function getGitHubRedirectUri(): string {
  return new URL("/api/auth/github/callback", env.APP_BASE_URL).toString();
}

export function getGitHubScopes(): string {
  return env.GITHUB_OAUTH_SCOPES?.trim() || DEFAULT_GITHUB_SCOPES;
}

export function buildGitHubAuthorizationUrl(state: string, codeChallenge: string): string {
  if (!env.GITHUB_CLIENT_ID) {
    throw new GitHubOAuthError("GitHub OAuth client id is not configured");
  }

  const url = new URL("https://github.com/login/oauth/authorize");

  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", getGitHubRedirectUri());
  url.searchParams.set("scope", getGitHubScopes());
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("allow_signup", "true");

  return url.toString();
}

export async function exchangeGitHubCode(
  code: string,
  codeVerifier: string,
): Promise<GitHubTokenResponse> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new GitHubOAuthError("GitHub OAuth is not configured");
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "RepoLog",
    },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: getGitHubRedirectUri(),
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = githubErrorSchema.safeParse(json);
    const message = parsedError.success
      ? (parsedError.data.error_description ?? parsedError.data.error)
      : "GitHub token exchange failed";

    throw new GitHubOAuthError(message, response.status);
  }

  const parsed = githubTokenSchema.safeParse(json);

  if (!parsed.success) {
    throw new GitHubOAuthError("GitHub returned an invalid token response");
  }

  return parsed.data;
}

async function githubFetch(path: string, accessToken: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "RepoLog",
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await githubFetch("/user", accessToken);

  if (!response.ok) {
    throw new GitHubApiError("Could not read the GitHub profile", response.status);
  }

  const json: unknown = await response.json();
  const parsed = githubUserSchema.safeParse(json);

  if (!parsed.success) {
    throw new GitHubApiError("GitHub returned an invalid profile", 502);
  }

  return parsed.data;
}

export async function fetchGitHubEmails(accessToken: string): Promise<GitHubEmail[]> {
  const response = await githubFetch("/user/emails", accessToken);

  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      return [];
    }

    throw new GitHubApiError("Could not read GitHub email addresses", response.status);
  }

  const json: unknown = await response.json();
  const parsed = z.array(githubEmailSchema).safeParse(json);

  return parsed.success ? parsed.data : [];
}

export function getPrimaryVerifiedEmail(emails: GitHubEmail[]): string | null {
  const primary = emails.find((email) => email.primary && email.verified);

  if (primary) {
    return primary.email;
  }

  const verified = emails.find((email) => email.verified);

  return verified?.email ?? null;
}
