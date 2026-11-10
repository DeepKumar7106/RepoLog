import { describe, expect, it } from "vitest";
import {
  createGitHubCommitClient,
  type GitHubCommit,
  type GitHubCommitFetch,
} from "@/lib/github/commits";

function commit(sha: string, overrides: Partial<GitHubCommit> = {}): GitHubCommit {
  return {
    sha,
    html_url: `https://github.com/owner/repo/commit/${sha}`,
    commit: {
      message: `Commit ${sha}`,
      author: {
        name: "Alice",
        email: "alice@example.com",
        date: "2026-01-01T10:00:00.000Z",
      },
      committer: { date: "2026-01-01T10:00:00.000Z" },
    },
    author: { id: 123, login: "alice" },
    ...overrides,
  };
}

describe("GitHub commit client", () => {
  it("follows Link pagination, sends filters, and deduplicates by sha", async () => {
    const calls: string[] = [];
    const headers: HeadersInit[] = [];
    const fetchImpl: GitHubCommitFetch = async (url, init) => {
      calls.push(url);
      headers.push(init?.headers ?? {});

      const page = new URL(url).searchParams.get("page");

      if (page === "1") {
        return new Response(JSON.stringify([commit("a"), commit("b")]), {
          status: 200,
          headers: {
            link: '<https://api.github.com/repos/owner/repo/commits?page=2>; rel="next"',
          },
        });
      }

      return new Response(JSON.stringify([commit("b"), commit("c")]), { status: 200 });
    };

    const client = createGitHubCommitClient(fetchImpl);
    const result = await client.listAll("secret-token", "owner", "repo", {
      sha: "main",
      perPage: 2,
      since: "2026-01-01T00:00:00.000Z",
    });

    expect(result.commits.map((entry) => entry.sha)).toEqual(["a", "b", "c"]);
    expect(result.pages).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("/repos/owner/repo/commits");
    expect(calls[0]).toContain("sha=main");
    expect(calls[0]).toContain("per_page=2");
    expect(calls[0]).toContain("since=2026-01-01T00%3A00%3A00.000Z");
    expect(headers[0]).toMatchObject({
      Accept: "application/vnd.github+json",
      Authorization: "Bearer secret-token",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "RepoLog",
    });
  });

  it("returns the next page from a Link header", async () => {
    const client = createGitHubCommitClient(
      async () =>
        new Response(JSON.stringify([commit("a")]), {
          status: 200,
          headers: {
            link: '<https://api.github.com/repos/owner/repo/commits?page=3>; rel="next"',
          },
        }),
    );

    const page = await client.listPage("token", "owner", "repo", {
      sha: "main",
      page: 2,
    });

    expect(page).toMatchObject({ page: 2, nextPage: 3 });
  });

  it("maps a 409 response to an EMPTY error", async () => {
    const client = createGitHubCommitClient(async () => new Response("", { status: 409 }));

    await expect(
      client.listPage("token", "owner", "repo", { sha: "main", page: 1 }),
    ).rejects.toMatchObject({
      code: "EMPTY",
      status: 409,
    });
  });

  it("maps a 401 response to an AUTH error", async () => {
    const client = createGitHubCommitClient(async () => new Response("", { status: 401 }));

    await expect(
      client.listPage("token", "owner", "repo", { sha: "main", page: 1 }),
    ).rejects.toMatchObject({
      code: "AUTH",
      status: 401,
    });
  });

  it("maps a 429 response to a rate-limit error with retry metadata", async () => {
    const client = createGitHubCommitClient(
      async () =>
        new Response("", {
          status: 429,
          headers: {
            "retry-after": "90",
            "x-ratelimit-remaining": "0",
          },
        }),
    );

    await expect(
      client.listPage("token", "owner", "repo", { sha: "main", page: 1 }),
    ).rejects.toMatchObject({
      code: "RATE_LIMIT",
      status: 429,
      retryAfterSeconds: 90,
    });
  });

  it("rejects a malformed GitHub response", async () => {
    const client = createGitHubCommitClient(
      async () => new Response(JSON.stringify([{ sha: 123 }]), { status: 200 }),
    );

    await expect(
      client.listPage("token", "owner", "repo", { sha: "main", page: 1 }),
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("stops at the configured pagination limit", async () => {
    const client = createGitHubCommitClient(async (url) => {
      const page = Number(new URL(url).searchParams.get("page"));

      return new Response(JSON.stringify([commit(`sha-${page}`)]), {
        status: 200,
        headers: {
          link: `<https://api.github.com/repos/owner/repo/commits?page=${page + 1}>; rel="next"`,
        },
      });
    });

    await expect(
      client.listAll("token", "owner", "repo", { sha: "main", maxPages: 2 }),
    ).rejects.toMatchObject({
      code: "PAGINATION_LIMIT",
      pagesProcessed: 2,
    });
  });
});
