import { describe, expect, it } from "vitest";
import {
  assertOwnedByTenant,
  createTenantContext,
  TenantAccessDeniedError,
  withTenantWhere,
} from "@/lib/tenancy/tenant-context";

describe("tenant context", () => {
  it("creates a frozen context with a trimmed user id", () => {
    const tenant = createTenantContext("  user-1  ");

    expect(tenant.userId).toBe("user-1");
    expect(Object.isFrozen(tenant)).toBe(true);
  });

  it("rejects an empty user id", () => {
    expect(() => createTenantContext("   ")).toThrow();
  });

  it("accepts a record owned by the tenant", () => {
    const tenant = createTenantContext("user-1");
    const record = { id: "record-1", userId: "user-1" };

    expect(assertOwnedByTenant(tenant, record)).toBe(record);
  });

  it("denies a record owned by another tenant", () => {
    const tenant = createTenantContext("user-1");

    expect(() => assertOwnedByTenant(tenant, { id: "record-1", userId: "user-2" })).toThrow(
      TenantAccessDeniedError,
    );
  });

  it("denies a missing record without distinguishing it from a foreign record", () => {
    const tenant = createTenantContext("user-1");

    expect(() => assertOwnedByTenant(tenant, null)).toThrow(TenantAccessDeniedError);
  });

  it("always adds the tenant user id to a query", () => {
    const tenant = createTenantContext("user-1");

    expect(withTenantWhere(tenant, { id: "record-1" })).toEqual({
      id: "record-1",
      userId: "user-1",
    });
  });
});
