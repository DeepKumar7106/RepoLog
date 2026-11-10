import { describe, expect, it } from "vitest";
import { absolutePublicUrl, publicProfilePath, publicProjectPath } from "@/lib/urls/public-urls";
import { isValidSlug, normalizeSlug } from "@/lib/urls/slugs";

describe("slug normalization", () => {
  it("lowercases and hyphenates user input", () => {
    expect(normalizeSlug("  Alex Smith! ")).toBe("alex-smith");
  });

  it("collapses repeated separators and trims edges", () => {
    expect(normalizeSlug("--Hello___World--")).toBe("hello-world");
  });

  it("bounds the slug length", () => {
    const result = normalizeSlug("a".repeat(80));

    expect(result.length).toBe(39);
  });

  it("validates normalized slugs", () => {
    expect(isValidSlug("alex-smith")).toBe(true);
    expect(isValidSlug("Alex")).toBe(false);
    expect(isValidSlug("-alex")).toBe(false);
    expect(isValidSlug("alex--smith")).toBe(false);
  });
});

describe("public URLs", () => {
  it("builds encoded profile and project paths", () => {
    expect(publicProfilePath("alex")).toBe("/u/alex");
    expect(publicProjectPath("alex", "task-manager")).toBe("/u/alex/projects/task-manager");
    expect(publicProfilePath("alex smith")).toBe("/u/alex%20smith");
  });

  it("builds absolute URLs from the configured base URL", () => {
    expect(absolutePublicUrl("/u/alex", "https://example.com")).toBe("https://example.com/u/alex");
  });
});
