import { z } from "zod";

const githubRepositorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  full_name: z.string().min(1),
  owner: z.object({
    login: z.string().min(1),
    type: z.string().min(1),
  }),
  description: z.string().nullable().optional(),
  html_url: z.string().url(),
  private: z.boolean(),
  visibility: z.string().optional(),
  default_branch: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => value ?? "main"),
  archived: z.boolean().optional(),
  fork: z.boolean().optional(),
});

export type GitHubRepository = z.infer<typeof githubRepositorySchema>;

export type GitHubRepositoryPage = {
  repositories: GitHubRepository[];
  page: number;
  nextPage: number | null;
};

export type GitHubRepositoryListOptions = {
  perPage?: number;
  maxPages?: number;
};

export type GitHubRepositoryListResult = {
  repositories: GitHubRepository[];
  pages: number;
};

export type GitHubRepositoryErrorCode =
  "AUTH" | "RATE_LIMIT" | "UNAVAILABLE" | "INVALID_RESPONSE" | "PAGINATION_LIMIT";

export class GitHubRepositoryError extends Error {
  readonly code: GitHubRepositoryErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  readonly pagesProcessed?: number;

  constructor(
    code: GitHubRepositoryErrorCode,
    message: string,
    options: {
      status?: number;
      retryAfterSeconds?: number;
      pagesProcessed?: number;
    } = {},
  ) {
    super(message);
    this.name = "GitHubRepositoryError";
    this.code = code;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.pagesProcessed = options.pagesProcessed;
  }
}

export type GitHubFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type GitHubRepositoryClient = {
  get(accessToken: string, owner: string, name: string): Promise<GitHubRepository>;
  listPage(accessToken: string, page: number, perPage?: number): Promise<GitHubRepositoryPage>;
  listAll(
    accessToken: string,
    options?: GitHubRepositoryListOptions,
  ): Promise<GitHubRepositoryListResult>;
};

export type GitHubRepositoryLister = Pick<GitHubRepositoryClient, "listAll">;

const GITHUB_REPOSITORIES_URL = "https://api.github.com/user/repos";
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

export function createGitHubRepositoryClient(
  fetchImpl: GitHubFetch = fetch,
): GitHubRepositoryClient {
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
      throw new GitHubRepositoryError("UNAVAILABLE", "GitHub request failed", {
        pagesProcessed,
      });
    }

    if (response.status === 401) {
      throw new GitHubRepositoryError("AUTH", "GitHub authorization failed", {
        status: 401,
        pagesProcessed,
      });
    }

    if (response.status === 403 || response.status === 429) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      const retryAfter = response.headers.get("retry-after");

      if (response.status === 429 || remaining === "0" || retryAfter) {
        throw new GitHubRepositoryError("RATE_LIMIT", "GitHub rate limit reached", {
          status: response.status,
          retryAfterSeconds: getRetryAfterSeconds(response),
          pagesProcessed,
        });
      }

      throw new GitHubRepositoryError("AUTH", "GitHub denied access to repository discovery", {
        status: response.status,
        pagesProcessed,
      });
    }

    if (!response.ok) {
      throw new GitHubRepositoryError("UNAVAILABLE", "GitHub request failed", {
        status: response.status,
        pagesProcessed,
      });
    }

    return response;
  }

  async function get(
    accessToken: string,
    owner: string,
    name: string,
  ): Promise<GitHubRepository> {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    const response = await request(url, accessToken, 0);

    let json: unknown;

    try {
      json = await response.json();
    } catch {
      throw new GitHubRepositoryError("INVALID_RESPONSE", "GitHub returned an invalid response", {
        status: response.status,
      });
    }

    const parsed = githubRepositorySchema.safeParse(json);

    if (!parsed.success) {
      throw new GitHubRepositoryError("INVALID_RESPONSE", "GitHub returned an invalid response", {
        status: response.status,
      });
    }

    return parsed.data;
  }

  async function listPage(
    accessToken: string,
    page: number,
    perPage = DEFAULT_PER_PAGE,
  ): Promise<GitHubRepositoryPage> {
    const url = new URL(GITHUB_REPOSITORIES_URL);

    url.searchParams.set("affiliation", "owner,collaborator,organization_member");
    url.searchParams.set("visibility", "all");
    url.searchParams.set("sort", "full_name");
    url.searchParams.set("direction", "asc");
    url.searchParams.set("per_page", String(normalizePerPage(perPage)));
    url.searchParams.set("page", String(page));

    const pagesProcessed = Math.max(0, page - 1);
    const response = await request(url.toString(), accessToken, pagesProcessed);

    let json: unknown;

    try {
      json = await response.json();
    } catch {
      throw new GitHubRepositoryError("INVALID_RESPONSE", "GitHub returned an invalid response", {
        status: response.status,
        pagesProcessed,
      });
    }

    const parsed = z.array(githubRepositorySchema).safeParse(json);

    if (!parsed.success) {
      throw new GitHubRepositoryError("INVALID_RESPONSE", "GitHub returned an invalid response", {
        status: response.status,
        pagesProcessed,
      });
    }

    const nextPage = parseNextPage(response.headers.get("link"));

    return {
      repositories: parsed.data,
      page,
      nextPage,
    };
  }

  async function listAll(
    accessToken: string,
    options: GitHubRepositoryListOptions = {},
  ): Promise<GitHubRepositoryListResult> {
    const perPage = normalizePerPage(options.perPage);
    const maxPages = normalizeMaxPages(options.maxPages);
    const repositories: GitHubRepository[] = [];
    const seenRepositoryIds = new Set<number>();
    let page: number | null = 1;
    let pages = 0;

    while (page !== null) {
      if (pages >= maxPages) {
        throw new GitHubRepositoryError(
          "PAGINATION_LIMIT",
          "Repository discovery exceeded the pagination limit",
          { pagesProcessed: pages },
        );
      }

      let result: GitHubRepositoryPage;

      try {
        result = await listPage(accessToken, page, perPage);
      } catch (error) {
        if (error instanceof GitHubRepositoryError) {
          throw new GitHubRepositoryError(error.code, error.message, {
            status: error.status,
            retryAfterSeconds: error.retryAfterSeconds,
            pagesProcessed: pages,
          });
        }

        throw error;
      }

      pages += 1;

      for (const repository of result.repositories) {
        if (!seenRepositoryIds.has(repository.id)) {
          seenRepositoryIds.add(repository.id);
          repositories.push(repository);
        }
      }

      if (result.repositories.length === 0 || result.nextPage === page) {
        break;
      }

      page = result.nextPage;
    }

    return { repositories, pages };
  }

  return { get, listPage, listAll };
}
