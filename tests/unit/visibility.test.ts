import { describe, expect, it } from "vitest";
import {
  canExposeCommitDetails,
  isProfilePublic,
  isProjectPubliclyVisible,
} from "@/lib/permissions/visibility";

describe("public visibility rules", () => {
  it("recognizes a public profile", () => {
    expect(isProfilePublic("PUBLIC")).toBe(true);
    expect(isProfilePublic("PRIVATE")).toBe(false);
  });

  it("requires both profile and project to be public", () => {
    expect(isProjectPubliclyVisible("PUBLIC", "PUBLIC")).toBe(true);
    expect(isProjectPubliclyVisible("PUBLIC", "PRIVATE")).toBe(false);
    expect(isProjectPubliclyVisible("PRIVATE", "PUBLIC")).toBe(false);
    expect(isProjectPubliclyVisible("PRIVATE", "PRIVATE")).toBe(false);
  });

  it("only exposes commit details for a publicly visible project with commit detail enabled", () => {
    expect(canExposeCommitDetails("PUBLIC", "PUBLIC", "COMMIT_DETAILS")).toBe(true);
    expect(canExposeCommitDetails("PUBLIC", "PUBLIC", "AGGREGATED")).toBe(false);
    expect(canExposeCommitDetails("PRIVATE", "PUBLIC", "COMMIT_DETAILS")).toBe(false);
    expect(canExposeCommitDetails("PUBLIC", "PRIVATE", "COMMIT_DETAILS")).toBe(false);
  });
});
