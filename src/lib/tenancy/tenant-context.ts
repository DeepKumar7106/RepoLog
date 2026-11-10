/**
 * The authenticated tenant for the current server request.
 *
 * The value is always derived on the server from the session. It must never
 * be populated from a client-supplied user id.
 */
export type TenantContext = Readonly<{
  userId: string;
}>;

/**
 * Thrown when a record is missing or belongs to another tenant.
 *
 * Both cases intentionally share the same error so callers cannot use the
 * response to probe whether another user's record exists.
 */
export class TenantAccessDeniedError extends Error {
  readonly code = "TENANT_ACCESS_DENIED";

  constructor() {
    super("Resource not found");
    this.name = "TenantAccessDeniedError";
  }
}

export function createTenantContext(userId: string): TenantContext {
  const normalized = userId.trim();

  if (normalized.length === 0) {
    throw new Error("A non-empty userId is required to create a tenant context");
  }

  return Object.freeze({ userId: normalized });
}

export function assertOwnedByTenant<T extends { userId: string }>(
  tenant: TenantContext,
  record: T | null | undefined,
): T {
  if (!record || record.userId !== tenant.userId) {
    throw new TenantAccessDeniedError();
  }

  return record;
}

export function withTenantWhere<T extends Record<string, unknown>>(
  tenant: TenantContext,
  where: T,
): T & { userId: string } {
  return { ...where, userId: tenant.userId };
}
