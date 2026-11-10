import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CrossOriginError } from "@/lib/api/csrf";
import { GitHubNotConnectedError } from "@/lib/auth/github-account";
import { getSessionTenant } from "@/lib/auth/session";
import { GitHubCommitError } from "@/lib/github/commits";
import { GitHubRepositoryError } from "@/lib/github/repositories";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";
import {
  RepositoryNotTrackedError,
  RepositorySyncInProgressError,
} from "@/server/services/repository-sync-service";

export class UnauthenticatedError extends Error {
  readonly code = "UNAUTHENTICATED";

  constructor() {
    super("Authentication required");
    this.name = "UnauthenticatedError";
  }
}

export class InvalidJsonError extends Error {
  readonly code = "VALIDATION_ERROR";

  constructor() {
    super("Request body must be valid JSON");
    this.name = "InvalidJsonError";
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidJsonError();
  }
}

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "GITHUB_NOT_CONNECTED"
  | "RATE_LIMITED"
  | "GITHUB_ERROR"
  | "SYNC_IN_PROGRESS"
  | "REPOSITORY_NOT_TRACKED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR";

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

export function unauthenticatedError(): NextResponse {
  return apiError("UNAUTHENTICATED", "Authentication required", 401);
}

export function notFoundError(): NextResponse {
  return apiError("NOT_FOUND", "Resource not found", 404);
}

export function notImplementedError(feature: string): NextResponse {
  return apiError("NOT_IMPLEMENTED", `${feature} is not implemented yet`, 501);
}

export async function requireApiTenant(): Promise<TenantContext> {
  const tenant = await getSessionTenant();

  if (!tenant) {
    throw new UnauthenticatedError();
  }

  return tenant;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthenticatedError) {
    return unauthenticatedError();
  }

  if (error instanceof InvalidJsonError) {
    return apiError("VALIDATION_ERROR", error.message, 400);
  }

  if (error instanceof CrossOriginError) {
    return apiError("FORBIDDEN", error.message, 403);
  }

  if (error instanceof GitHubNotConnectedError) {
    return apiError("GITHUB_NOT_CONNECTED", error.message, 409);
  }

  if (error instanceof GitHubCommitError) {
    switch (error.code) {
      case "AUTH":
        return apiError(
          "GITHUB_NOT_CONNECTED",
          "GitHub authorization is no longer valid. Reconnect GitHub.",
          409,
        );
      case "RATE_LIMIT":
        return apiError(
          "RATE_LIMITED",
          "GitHub rate limit reached. Try again later.",
          429,
          error.retryAfterSeconds === undefined
            ? undefined
            : { retryAfterSeconds: error.retryAfterSeconds },
        );
      case "NOT_FOUND":
        return apiError("NOT_FOUND", "GitHub repository or branch was not found.", 404);
      case "UNAVAILABLE":
      case "INVALID_RESPONSE":
      case "EMPTY":
      case "PAGINATION_LIMIT":
        return apiError("GITHUB_ERROR", "GitHub could not return commit history.", 502);
    }
  }

  if (error instanceof RepositorySyncInProgressError) {
    return apiError("SYNC_IN_PROGRESS", error.message, 409);
  }

  if (error instanceof RepositoryNotTrackedError) {
    return apiError("REPOSITORY_NOT_TRACKED", error.message, 409);
  }

  if (error instanceof GitHubRepositoryError) {
    switch (error.code) {
      case "AUTH":
        return apiError(
          "GITHUB_NOT_CONNECTED",
          "GitHub authorization is no longer valid. Reconnect GitHub.",
          409,
        );
      case "RATE_LIMIT":
        return apiError(
          "RATE_LIMITED",
          "GitHub rate limit reached. Try again later.",
          429,
          error.retryAfterSeconds === undefined
            ? undefined
            : { retryAfterSeconds: error.retryAfterSeconds },
        );
      case "UNAVAILABLE":
        return apiError("GITHUB_ERROR", "GitHub is temporarily unavailable. Try again later.", 502);
      case "INVALID_RESPONSE":
        return apiError("GITHUB_ERROR", "GitHub returned an unexpected response.", 502);
      case "PAGINATION_LIMIT":
        return apiError("GITHUB_ERROR", "Repository discovery exceeded the pagination limit.", 502);
    }
  }

  if (error instanceof TenantAccessDeniedError) {
    return notFoundError();
  }

  if (error instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Invalid request", 400, error.issues);
  }

  console.error("[api] Unhandled error", error);
  return apiError("INTERNAL_ERROR", "Unexpected server error", 500);
}
