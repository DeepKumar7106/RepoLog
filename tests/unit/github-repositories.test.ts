import { describe, expect, it } from "vitest";
import {
  createGitHubRepositoryClient,
  type GitHubFetch,
  type GitHubRepository,
} from "@/lib/github/repositories";

function repository(id: number, overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id,
    name: `repo-${id}`,
    full_name: `owner/repo-${id}`,
    owner: { login: "owner", type: "User" },
    description: null,
    html_url: `https://github.com/owner/repo-${id}`,
    private: false,
    visibility: "public",
    default_branch: "main",
    archived: false,
    fork: false,
    ...overrides,
  };
}

describe("GitHub repository client", () => {
  it("follows Link pagination and deduplicates repositories by id", async () => {
    const calls: string[] = [];
    const headers: HeadersInit[] = [];
    const fetchImpl: GitHubFetch = async (url, init) => {
      calls.push(url);
      headers.push(init?.headers ?? {});

      const page = new URL(url).searchParams.get("page");

      if (page === "1") {
        return new Response(JSON.stringify([repository(1), repository(2)]), {
          status: 200,
          headers: {
            link: '<https://api.github.com/user/repos?page=2>; rel="next"',
          },
        });
      }

      return new Response(JSON.stringify([repository(2), repository(3)]), { status: 200 });
    };

    const client = createGitHubRepositoryClient(fetchImpl);
    const result = await client.listAll("secret-token", { perPage: 2 });

    expect(result.repositories.map((repo) => repo.id)).toEqual([1, 2, 3]);
    expect(result.pages).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("affiliation=owner%2Ccollaborator%2Corganization_member");
    expect(calls[0]).toContain("visibility=all");
    expect(calls[0]).toContain("per_page=2");
    expect(headers[0]).toMatchObject({
      Accept: "application/vnd.github+json",
      Authorization: "Bearer secret-token",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "RepoLog",
    });
  });

  it("maps a 401 response to an AUTH error", async () => {
    const client = createGitHubRepositoryClient(async () => new Response("", { status: 401 }));

    await expect(client.listAll("expired-token")).rejects.toMatchObject({
      code: "AUTH",
      status: 401,
    });
  });

  it("maps a 429 response to a rate-limit error with retry metadata", async () => {
    const client = createGitHubRepositoryClient(
      async () =>
        new Response("", {
          status: 429,
          headers: {
            "retry-after": "120",
            "x-ratelimit-remaining": "0",
          },
        }),
    );

    await expect(client.listAll("token")).rejects.toMatchObject({
      code: "RATE_LIMIT",
      status: 429,
      retryAfterSeconds: 120,
    });
  });

  it("rejects a malformed GitHub response", async () => {
    const client = createGitHubRepositoryClient(
      async () => new Response(JSON.stringify([{ id: "not-a-number" }]), { status: 200 }),
    );

    await expect(client.listAll("token")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("stops at the configured pagination limit", async () => {
    const client = createGitHubRepositoryClient(async (url) => {
      const page = Number(new URL(url).searchParams.get("page"));

      return new Response(JSON.stringify([repository(page)]), {
        status: 200,
        headers: {
          link: `<https://api.github.com/user/repos?page=${page + 1}>; rel="next"`,
        },
      });
    });

    await expect(client.listAll("token", { maxPages: 2 })).rejects.toMatchObject({
      code: "PAGINATION_LIMIT",
      pagesProcessed: 2,
    });
  });
});
