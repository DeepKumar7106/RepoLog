import { describe, expect, it } from "vitest";
import { matchCommitAuthor } from "@/lib/github/author-matching";

const user = {
  githubUserId: "123",
  verifiedEmails: ["Alice@Example.com"],
};

describe("commit author matching", () => {
  it("matches the immutable GitHub user id first", () => {
    expect(matchCommitAuthor({ githubUserId: "123", email: "different@example.com" }, user)).toBe(
      "GITHUB_USER",
    );
  });

  it("falls back to a verified email case-insensitively", () => {
    expect(matchCommitAuthor({ githubUserId: "999", email: " alice@example.com " }, user)).toBe(
      "VERIFIED_EMAIL",
    );
  });

  it("matches verified email when the commit has no GitHub user", () => {
    expect(matchCommitAuthor({ githubUserId: null, email: "ALICE@example.com" }, user)).toBe(
      "VERIFIED_EMAIL",
    );
  });

  it("does not match unverified or unknown email addresses", () => {
    expect(matchCommitAuthor({ githubUserId: "999", email: "unknown@example.com" }, user)).toBe(
      "UNMATCHED",
    );
    expect(matchCommitAuthor({ githubUserId: null, email: null }, user)).toBe("UNMATCHED");
  });

  it("does not match a different GitHub user id even with a known email", () => {
    expect(
      matchCommitAuthor(
        { githubUserId: "999", email: "alice@example.com" },
        { ...user, verifiedEmails: [] },
      ),
    ).toBe("UNMATCHED");
  });
});
