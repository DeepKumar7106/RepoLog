export const GITHUB_PROVIDER = "github";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const OAUTH_COOKIE_TTL_SECONDS = 60 * 10;

export const OAUTH_STATE_COOKIE = "reporlog_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "reporlog_oauth_verifier";
export const OAUTH_MODE_COOKIE = "reporlog_oauth_mode";
export const OAUTH_EXPECTED_USER_COOKIE = "reporlog_oauth_expected_user";

export const DEFAULT_GITHUB_SCOPES = "read:user user:email repo";

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-reporlog_session" : "reporlog_session";
}

export function getLegacySessionCookieName(): string {
  return getSessionCookieName() === "reporlog_session"
    ? "__Host-reporlog_session"
    : "reporlog_session";
}
