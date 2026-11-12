import { describe, expect, it } from "vitest";
import {
  SummaryProviderError,
  createMockSummaryProvider,
  createSummaryProvider,
} from "@/lib/summaries/provider";
import { summaryOutputSchema } from "@/lib/summaries/schema";
import type { SummaryInput } from "@/lib/summaries/types";

const input: SummaryInput = {
  date: "2026-01-15",
  timezone: "UTC",
  totalCommits: 3,
  projects: [
    {
      projectId: "project-1",
      projectTitle: "RepoLog",
      commitCount: 3,
      commitMessages: ["Add summaries", "Fix cache invalidation"],
      additions: 20,
      deletions: 4,
    },
  ],
};

describe("summary provider", () => {
  it("produces schema-valid deterministic output", async () => {
    const provider = createMockSummaryProvider();
    const output = await provider.generate(input);

    expect(summaryOutputSchema.safeParse(output).success).toBe(true);
    expect(output.projectHighlights[0]).toMatchObject({ projectId: "project-1" });
    expect(output.summary).toContain("3 qualifying commits");
  });

  it("validates the output shape strictly", () => {
    expect(
      summaryOutputSchema.safeParse({
        headline: "Valid",
        summary: "Valid",
        projectHighlights: [{ projectId: "project-1", text: "Work", extra: true }],
      }).success,
    ).toBe(false);
    expect(
      summaryOutputSchema.safeParse({
        headline: "x".repeat(121),
        summary: "Valid",
        projectHighlights: [],
      }).success,
    ).toBe(false);
  });

  it("creates configured providers and rejects missing credentials", () => {
    expect(createSummaryProvider({ provider: "mock" })).toMatchObject({ name: "mock" });
    expect(createSummaryProvider({ provider: "deterministic" })).toMatchObject({ name: "mock" });
    expect(createSummaryProvider({ provider: "openai", apiKey: null })).toBeNull();
    expect(createSummaryProvider({ provider: "unknown" })).toBeNull();
    expect(createSummaryProvider({ provider: null })).toBeNull();
  });

  it("exposes safe provider error codes", () => {
    const error = new SummaryProviderError("INVALID_OUTPUT", "Bad output");

    expect(error.code).toBe("INVALID_OUTPUT");
    expect(error.name).toBe("SummaryProviderError");
  });
});
