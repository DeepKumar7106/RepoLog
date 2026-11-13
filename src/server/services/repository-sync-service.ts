import { Prisma } from "@/generated/prisma/client";
import type { BackfillStatus, SyncStatus, SyncTrigger } from "@/generated/prisma/enums";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { matchCommitAuthor } from "@/lib/github/author-matching";
import {
  createGitHubCommitClient,
  GitHubCommitError,
  type GitHubCommit,
  type GitHubCommitLister,
} from "@/lib/github/commits";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";

const DEFAULT_MAX_PAGES = 20;
const STALE_SYNC_MS = 15 * 60 * 1000;
const OVERLAP_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const COMMIT_BATCH_SIZE = 100;

export class RepositorySyncInProgressError extends Error {
  readonly code = "SYNC_IN_PROGRESS";

  constructor() {
    super("A sync is already running for this repository");
    this.name = "RepositorySyncInProgressError";
  }
}

export class RepositoryNotTrackedError extends Error {
  readonly code = "REPOSITORY_NOT_TRACKED";

  constructor() {
    super("Enable tracking for this repository before syncing it");
    this.name = "RepositoryNotTrackedError";
  }
}

export type RepositorySyncOptions = {
  trigger?: SyncTrigger;
  syncRunId?: string;
  maxPages?: number;
  perPage?: number;
  now?: Date;
};

export type RepositorySyncResult = {
  syncRunId: string;
  userRepositoryId: string;
  mode: "BACKFILL" | "INCREMENTAL";
  status: "SUCCEEDED" | "PARTIAL";
  syncStatus: SyncStatus;
  backfillStatus: BackfillStatus;
  pagesProcessed: number;
  commitsProcessed: number;
  commitsInserted: number;
  hasMore: boolean;
  lastSyncedAt: string | null;
};

type MatchedCommit = {
  commit: GitHubCommit;
  authorMatchMethod: "GITHUB_USER" | "VERIFIED_EMAIL";
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function parseBackfillCursor(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : null;
}

function parseDateCursor(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function safeTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

function toLocalDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") =>
    parts.find((entry) => entry.type === type)?.value ?? "00";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function sumNullable(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);

  return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0);
}

function syncErrorCode(error: unknown): string {
  if (error instanceof GitHubCommitError) {
    switch (error.code) {
      case "AUTH":
        return "GITHUB_AUTH";
      case "RATE_LIMIT":
        return "GITHUB_RATE_LIMIT";
      case "UNAVAILABLE":
        return "GITHUB_UNAVAILABLE";
      case "INVALID_RESPONSE":
        return "GITHUB_INVALID_RESPONSE";
      case "NOT_FOUND":
        return "GITHUB_NOT_FOUND";
      case "EMPTY":
        return "GITHUB_EMPTY";
      case "PAGINATION_LIMIT":
        return "GITHUB_PAGINATION_LIMIT";
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return "DATABASE_ERROR";
  }

  return "UNKNOWN";
}

function syncErrorMessage(error: unknown): string {
  if (error instanceof GitHubCommitError) {
    return error.message;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return "Could not save commit history";
  }

  return "Repository sync failed";
}

export function createRepositorySyncService(
  db: AppPrismaClient,
  commitClient: GitHubCommitLister = createGitHubCommitClient(),
) {
  async function recalculateDailyActivity(input: {
    tenant: TenantContext;
    projectId: string;
    userRepositoryId: string;
    timezone: string;
    dateKeys: Set<string>;
    now: Date;
  }) {
    for (const dateKey of input.dateKeys) {
      const date = dateKeyToUtcDate(dateKey);
      const rangeEnd = new Date(date.getTime() + 2 * DAY_MS);
      const commits = await db.commit.findMany({
        where: {
          userId: input.tenant.userId,
          userRepositoryId: input.userRepositoryId,
          isOnDefaultBranch: true,
          authorDate: { gte: date, lt: rangeEnd },
        },
        select: {
          authorDate: true,
          additions: true,
          deletions: true,
          changedFiles: true,
        },
      });
      const dayCommits = commits.filter(
        (commit) => toLocalDateKey(commit.authorDate, input.timezone) === dateKey,
      );

      if (dayCommits.length === 0) {
        continue;
      }

      const firstCommitAt = dayCommits.reduce(
        (earliest, commit) => (commit.authorDate < earliest ? commit.authorDate : earliest),
        dayCommits[0].authorDate,
      );
      const lastCommitAt = dayCommits.reduce(
        (latest, commit) => (commit.authorDate > latest ? commit.authorDate : latest),
        dayCommits[0].authorDate,
      );

      await db.dailyProjectActivity.upsert({
        where: {
          projectId_date_timezone: {
            projectId: input.projectId,
            date,
            timezone: input.timezone,
          },
        },
        update: {
          commitCount: dayCommits.length,
          additions: sumNullable(dayCommits.map((commit) => commit.additions)),
          deletions: sumNullable(dayCommits.map((commit) => commit.deletions)),
          changedFiles: sumNullable(dayCommits.map((commit) => commit.changedFiles)),
          firstCommitAt,
          lastCommitAt,
          lastCalculatedAt: input.now,
        },
        create: {
          userId: input.tenant.userId,
          projectId: input.projectId,
          date,
          timezone: input.timezone,
          commitCount: dayCommits.length,
          additions: sumNullable(dayCommits.map((commit) => commit.additions)),
          deletions: sumNullable(dayCommits.map((commit) => commit.deletions)),
          changedFiles: sumNullable(dayCommits.map((commit) => commit.changedFiles)),
          firstCommitAt,
          lastCommitAt,
          lastCalculatedAt: input.now,
        },
      });
    }
  }

  async function recalculateProjectDates(input: {
    tenant: TenantContext;
    projectId: string;
    userRepositoryId: string;
  }) {
    const aggregate = await db.commit.aggregate({
      where: {
        userId: input.tenant.userId,
        userRepositoryId: input.userRepositoryId,
        isOnDefaultBranch: true,
      },
      _min: { authorDate: true },
      _max: { authorDate: true },
    });

    await db.project.update({
      where: { id: input.projectId },
      data: {
        firstCommitAt: aggregate._min.authorDate,
        latestCommitAt: aggregate._max.authorDate,
      },
    });
  }

  return {
    async sync(
      tenant: TenantContext,
      userRepositoryId: string,
      accessToken: string,
      options: RepositorySyncOptions = {},
    ): Promise<RepositorySyncResult> {
      const now = options.now ?? new Date();
      const connection = await db.userRepository.findFirst({
        where: { id: userRepositoryId, userId: tenant.userId },
        include: {
          githubRepository: true,
          project: true,
        },
      });

      if (!connection) {
        throw new TenantAccessDeniedError();
      }

      if (!connection.trackingEnabled) {
        throw new RepositoryNotTrackedError();
      }

      const user = await db.user.findUniqueOrThrow({
        where: { id: tenant.userId },
        select: {
          githubUserId: true,
          timezone: true,
          authorEmails: {
            where: { verifiedByUser: true },
            select: { email: true },
          },
        },
      });

      const mode = connection.backfillStatus === "COMPLETE" ? "INCREMENTAL" : "BACKFILL";
      const isBackfill = mode === "BACKFILL";
      const startPage = isBackfill ? (parseBackfillCursor(connection.backfillCursor) ?? 1) : 1;
      const since = isBackfill
        ? undefined
        : (() => {
            const cursor = parseDateCursor(connection.syncCursor) ?? connection.lastSyncedAt;

            return cursor ? new Date(cursor.getTime() - OVERLAP_MS).toISOString() : undefined;
          })();
      const timezone = safeTimeZone(user.timezone);
      const verifiedEmails = user.authorEmails.map((email) => email.email);
      const staleBefore = new Date(now.getTime() - STALE_SYNC_MS);
      const lock = await db.userRepository.updateMany({
        where: {
          id: connection.id,
          userId: tenant.userId,
          OR: [{ syncStatus: { not: "RUNNING" } }, { updatedAt: { lt: staleBefore } }],
        },
        data: {
          syncStatus: "RUNNING",
          ...(isBackfill ? { backfillStatus: "IN_PROGRESS" } : {}),
        },
      });

      if (lock.count === 0) {
        throw new RepositorySyncInProgressError();
      }

      let run: { id: string; trigger: SyncTrigger };

      if (options.syncRunId) {
        const existingRun = await db.syncRun.findFirst({
          where: {
            id: options.syncRunId,
            userId: tenant.userId,
            userRepositoryId: connection.id,
          },
          select: { id: true, trigger: true },
        });

        if (!existingRun) {
          throw new TenantAccessDeniedError();
        }

        run = existingRun;
      } else {
        const trigger =
          options.trigger ??
          (isBackfill && connection.backfillStatus === "NOT_STARTED" ? "INITIAL" : "ADMIN");

        run = await db.syncRun.create({
          data: {
            userId: tenant.userId,
            userRepositoryId: connection.id,
            trigger,
            status: "RUNNING",
          },
          select: { id: true, trigger: true },
        });
      }

      await db.syncRun.updateMany({
        where: {
          userId: tenant.userId,
          userRepositoryId: connection.id,
          status: "RUNNING",
          id: { not: run.id },
        },
        data: {
          status: "FAILED",
          finishedAt: now,
          errorCode: "STALE_SYNC",
          errorMessage: "Superseded by a newer sync run",
          lockedAt: null,
        },
      });

      await db.syncRun.update({
        where: { id: run.id },
        data: {
          status: "RUNNING",
          startedAt: now,
          lockedAt: now,
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });

      let pagesProcessed = 0;
      let commitsProcessed = 0;
      let commitsInserted = 0;

      try {
        const maxPages = clamp(options.maxPages ?? DEFAULT_MAX_PAGES, 1, 100);
        const perPage = clamp(options.perPage ?? 100, 1, 100);
        const matchedCommits: MatchedCommit[] = [];
        const seenShas = new Set<string>();
        let page: number | null = startPage;

        while (page !== null && pagesProcessed < maxPages) {
          let result;

          try {
            result = await commitClient.listPage(
              accessToken,
              connection.githubRepository.ownerLogin,
              connection.githubRepository.name,
              {
                sha: connection.githubRepository.defaultBranch,
                page,
                perPage,
                ...(since ? { since } : {}),
              },
            );
          } catch (error) {
            if (error instanceof GitHubCommitError && error.code === "EMPTY") {
              page = null;
              break;
            }

            throw error;
          }

          pagesProcessed += 1;
          commitsProcessed += result.commits.length;

          for (const commit of result.commits) {
            if (seenShas.has(commit.sha)) {
              continue;
            }

            seenShas.add(commit.sha);

            const authorMatchMethod = matchCommitAuthor(
              {
                githubUserId: commit.author ? String(commit.author.id) : null,
                email: commit.commit.author.email ?? null,
              },
              {
                githubUserId: user.githubUserId,
                verifiedEmails,
              },
            );

            if (authorMatchMethod !== "UNMATCHED") {
              matchedCommits.push({ commit, authorMatchMethod });
            }
          }

          if (result.commits.length === 0 || result.nextPage === page) {
            page = null;
          } else {
            page = result.nextPage;
          }
        }

        for (const batch of chunk(matchedCommits, COMMIT_BATCH_SIZE)) {
          const result = await db.commit.createMany({
            data: batch.map(({ commit, authorMatchMethod }) => ({
              userId: tenant.userId,
              userRepositoryId: connection.id,
              sha: commit.sha,
              authorGithubUserId: commit.author ? String(commit.author.id) : null,
              authorLogin: commit.author?.login ?? null,
              authorName: commit.commit.author.name,
              authorEmail: commit.commit.author.email ?? null,
              authorDate: new Date(commit.commit.author.date),
              committerDate: new Date(commit.commit.committer?.date ?? commit.commit.author.date),
              message: commit.commit.message,
              htmlUrl: commit.html_url,
              authorMatchMethod,
              isOnDefaultBranch: true,
              firstSeenAt: now,
            })),
            skipDuplicates: true,
          });

          commitsInserted += result.count;
        }

        if (connection.project) {
          await recalculateProjectDates({
            tenant,
            projectId: connection.project.id,
            userRepositoryId: connection.id,
          });

          const dateKeys = new Set(
            matchedCommits.map(({ commit }) =>
              toLocalDateKey(new Date(commit.commit.author.date), timezone),
            ),
          );

          await recalculateDailyActivity({
            tenant,
            projectId: connection.project.id,
            userRepositoryId: connection.id,
            timezone,
            dateKeys,
            now,
          });
        }

        const hasMore = page !== null;
        const syncStatus: SyncStatus = hasMore ? "PARTIAL" : "SUCCEEDED";
        const backfillStatus: BackfillStatus = isBackfill
          ? hasMore
            ? "IN_PROGRESS"
            : "COMPLETE"
          : connection.backfillStatus;
        const lastSyncedAt = hasMore ? connection.lastSyncedAt : now;
        const syncCursor = hasMore ? connection.syncCursor : now.toISOString();
        const backfillCursor = isBackfill
          ? hasMore && page !== null
            ? String(page)
            : null
          : connection.backfillCursor;

        await db.userRepository.update({
          where: { id: connection.id },
          data: {
            syncStatus,
            backfillStatus,
            lastSyncedAt,
            syncCursor,
            backfillCursor,
          },
        });

        await db.syncRun.update({
          where: { id: run.id },
          data: {
            status: hasMore ? "PARTIAL" : "SUCCEEDED",
            finishedAt: new Date(),
            lockedAt: null,
            pagesProcessed,
            commitsProcessed,
            commitsInserted,
          },
        });

        return {
          syncRunId: run.id,
          userRepositoryId: connection.id,
          mode,
          status: hasMore ? "PARTIAL" : "SUCCEEDED",
          syncStatus,
          backfillStatus,
          pagesProcessed,
          commitsProcessed,
          commitsInserted,
          hasMore,
          lastSyncedAt: lastSyncedAt ? lastSyncedAt.toISOString() : null,
        };
      } catch (error) {
        const errorCode = syncErrorCode(error);
        const errorMessage = syncErrorMessage(error);
        const backfillStatus: BackfillStatus = isBackfill
          ? pagesProcessed > 0
            ? "PARTIAL"
            : "FAILED"
          : connection.backfillStatus;

        await db.userRepository
          .updateMany({
            where: { id: connection.id, userId: tenant.userId },
            data: {
              syncStatus: "FAILED",
              ...(isBackfill ? { backfillStatus } : {}),
            },
          })
          .catch(() => undefined);

        await db.syncRun
          .update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              finishedAt: new Date(),
              lockedAt: null,
              pagesProcessed,
              commitsProcessed,
              commitsInserted,
              errorCode,
              errorMessage,
            },
          })
          .catch(() => undefined);

        throw error;
      }
    },
  };
}

export type RepositorySyncService = ReturnType<typeof createRepositorySyncService>;
