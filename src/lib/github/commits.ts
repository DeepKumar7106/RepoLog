import { z } from "zod";

const githubCommitSchema = z.object({
  sha: z.string().min(1),
  html_url: z.string().url(),
  commit: z.object({
    message: z.string(),
    author: z.object({
      name: z.string().min(1),
      email: z.string().email().nullable().optional(),
      date: z.string().datetime(),
    }),
    committer: z
      .object({
        date: z.string().datetime(),
      })
      .nullable()
      .optional(),
  }),
  author: z
    .object({
      id: z.number().int().positive(),
      login: z.string().min(1),
    })
    .nullable()
    .optional(),
});

export type GitHubCommit = z.infer<typeof githubCommitSchema>;

export type GitHubCommitPage = {
  commits: GitHubCommit[];
  page: number;
  nextPage: number | null;
};

export type GitHubCommitListOptions = {
  sha: string;
  page: number;
  perPage?: number;
  since?: string;
  until?: string;
};

export type GitHubCommitListAllOptions = Omit<GitHubCommitListOptions, "page"> & {
  maxPages?: number;
};

export type GitHubCommitListResult = {
  commits: GitHubCommit[];
  pages: number;
};

export type GitHubCommitErrorCode =
  "AUTH" | "RATE_LIMIT" | "UNAVAILABLE" | "INVALID_RESPONSE" | "NOT_FOUND" | "EMPTY" | "PAGINATION_LIMIT";

export class GitHubCommitError extends Error {
  readonly code: GitHubCommitErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  readonly pagesProcessed?: number;

  constructor(
    code: GitHubCommitErrorCode,
    message: string,
    options: {
      status?: number;
      retryAfterSeconds?: number;
      pagesProcessed?: number;
    } = {},
  ) {
    super(message);
    this.name = "GitHubCommitError";
    this.code = code;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.pagesProcessed = options.pagesProcessed;
  }
}

export type GitHubCommitFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type GitHubCommitClient = {
  listPage(
    accessToken: string,
    owner: string,
    name: string,
    options: GitHubCommitListOptions,
  ): Promise<GitHubCommitPage>;
  listAll(
    accessToken: string,
    owner: string,
    name: string,
    options: GitHubCommitListAllOptions,
  ): Promise<GitHubCommitListResult>;
};

export type GitHubCommitLister = Pick<GitHubCommitClient, "listPage">;

const GITHUB_API_URL = "https://api.github.com";
const DEFAULT_PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 200;

function parseNextPage(linkHeader: string | null): number | null {
  if (!linkHeader) {
    return null;
  }

  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);

  if (!match) {
    return null;
  }

  try {
    const nextUrl = new URL(match[1]);
    const nextPage = Number(nextUrl.searchParams.get("page"));

    return Number.isInteger(nextPage) && nextPage > 0 ? nextPage : null;
  } catch {
    return null;
  }
}

function getRetryAfterSeconds(response: Response): number | undefined {
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds);
    }

    const retryDate = Date.parse(retryAfter);

    if (!Number.isNaN(retryDate)) {
      return Math.max(1, Math.ceil((retryDate - Date.now()) / 1000));
    }
  }

  const reset = response.headers.get("x-ratelimit-reset");

  if (reset) {
    const resetEpoch = Number(reset);

    if (Number.isFinite(resetEpoch)) {
      return Math.max(1, resetEpoch - Math.floor(Date.now() / 1000));
    }
  }

  return undefined;
}

function normalizePerPage(value: number | undefined): number {
  return Math.min(Math.max(Math.floor(value ?? DEFAULT_PER_PAGE), 1), DEFAULT_PER_PAGE);
}

function normalizeMaxPages(value: number | undefined): number {
  return Math.min(Math.max(Math.floor(value ?? DEFAULT_MAX_PAGES), 1), 1000);
}

function commitsUrl(
  owner: string,
  name: string,
  page: number,
  perPage: number,
  options: Pick<GitHubCommitListOptions, "sha" | "since" | "until">,
): string {
  const url = new URL(
    `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits`,
  );

  url.searchParams.set("sha", options.sha);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));

  if (options.since) {
    url.searchParams.set("since", options.since);
  }

  if (options.until) {
    url.searchParams.set("until", options.until);
  }

  return url.toString();
}

export function createGitHubCommitClient(
  fetchImpl: GitHubCommitFetch = fetch,
): GitHubCommitClient {
  async function request(
    url: string,
    accessToken: string,
    pagesProcessed: number,
  ): Promise<Response> {
    let response: Response;

    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "RepoLog",
        },
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new GitHubCommitError("UNAVAILABLE", "GitHub commit request failed", {
        pagesProcessed,
      });
    }

    if (response.status === 401) {
      throw new GitHubCommitError("AUTH", "GitHub authorization failed", {
        status: 401,
        pagesProcessed,
      });
    }

    if (response.status === 403 || response.status === 429) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      const retryAfter = response.headers.get("retry-after");

      if (response.status === 429 || remaining === "0" || retryAfter) {
        throw new GitHubCommitError("RATE_LIMIT", "GitHub rate limit reached", {
          status: response.status,
          retryAfterSeconds: getRetryAfterSeconds(response),
          pagesProcessed,
        });
      }

      throw new GitHubCommitError("AUTH", "GitHub denied access to commit history", {
        status: response.status,
        pagesProcessed,
      });
    }

    if (response.status === 404) {
      throw new GitHubCommitError("NOT_FOUND", "GitHub repository or branch was not found", {
        status: 404,
        pagesProcessed,
      });
    }

    if (response.status === 409) {
      throw new GitHubCommitError("EMPTY", "GitHub repository has no commits", {
        status: 409,
        pagesProcessed,
      });
    }

    if (!response.ok) {
      throw new GitHubCommitError("UNAVAILABLE", "GitHub commit request failed", {
        status: response.status,
        pagesProcessed,
      });
    }

    return response;
  }

  async function listPage(
    accessToken: string,
    owner: string,
    name: string,
    options: GitHubCommitListOptions,
  ): Promise<GitHubCommitPage> {
    const perPage = normalizePerPage(options.perPage);
    const pagesProcessed = Math.max(0, options.page - 1);
    const response = await request(
      commitsUrl(owner, name, options.page, perPage, options),
      accessToken,
      pagesProcessed,
    );

    let json: unknown;

    try {
      json = await response.json();
    } catch {
      throw new GitHubCommitError("INVALID_RESPONSE", "GitHub returned an invalid response", {
        status: response.status,
        pagesProcessed,
      });
    }

    const parsed = z.array(githubCommitSchema).safeParse(json);

    if (!parsed.success) {
      throw new GitHubCommitError("INVALID_RESPONSE", "GitHub returned an invalid response", {
        status: response.status,
        pagesProcessed,
      });
    }

    return {
      commits: parsed.data,
      page: options.page,
      nextPage: parseNextPage(response.headers.get("link")),
    };
  }

  async function listAll(
    accessToken: string,
    owner: string,
    name: string,
    options: GitHubCommitListAllOptions,
  ): Promise<GitHubCommitListResult> {
    const perPage = normalizePerPage(options.perPage);
    const { maxPages: configuredMaxPages, ...listOptions } = options;
    const maxPages = normalizeMaxPages(configuredMaxPages);
    const commits: GitHubCommit[] = [];
    const seenShas = new Set<string>();
    let page: number | null = 1;
    let pages = 0;

    while (page !== null) {
      if (pages >= maxPages) {
        throw new GitHubCommitError(
          "PAGINATION_LIMIT",
          "Commit history exceeded the pagination limit",
          { pagesProcessed: pages },
        );
      }

      let result: GitHubCommitPage;

      try {
        result = await listPage(accessToken, owner, name, {
          ...listOptions,
          page,
          perPage,
        });
      } catch (error) {
        if (error instanceof GitHubCommitError) {
          throw new GitHubCommitError(error.code, error.message, {
            status: error.status,
            retryAfterSeconds: error.retryAfterSeconds,
            pagesProcessed: pages,
          });
        }

        throw error;
      }

      pages += 1;

      for (const commit of result.commits) {
        if (!seenShas.has(commit.sha)) {
          seenShas.add(commit.sha);
          commits.push(commit);
        }
      }

      if (result.commits.length === 0 || result.nextPage === page) {
        break;
      }

      page = result.nextPage;
    }

    return { commits, pages };
  }

  return { listPage, listAll };
}
