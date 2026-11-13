import { Prisma } from "@/generated/prisma/client";
import type { SyncTrigger } from "@/generated/prisma/enums";
import { GITHUB_PROVIDER } from "@/lib/auth/constants";
import { getDecryptedAccessToken, GitHubNotConnectedError } from "@/lib/auth/github-account";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import {
  createGitHubCommitClient,
  GitHubCommitError,
  type GitHubCommitLister,
} from "@/lib/github/commits";
import { createTenantContext, type TenantContext } from "@/lib/tenancy/tenant-context";
import {
  createRepositorySyncService,
  RepositoryNotTrackedError,
  RepositorySyncInProgressError,
} from "@/server/services/repository-sync-service";

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_SYNC_INTERVAL_HOURS = 6;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_PROCESS_LIMIT = 5;
const DEFAULT_PER_USER_LIMIT = 2;
const DEFAULT_MAX_PAGES = 10;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const STALE_LOCK_MS = 15 * 60 * 1000;

type EnqueueInput = {
  userId: string;
  userRepositoryId: string;
  trigger: SyncTrigger;
  dedupeKey?: string;
  availableAt?: Date;
};

type ScheduledSyncOptions = {
  now?: Date;
  intervalHours?: number;
  perUserLimit?: number;
  limit?: number;
};

type ProcessOptions = {
  now?: Date;
  limit?: number;
  perUserLimit?: number;
  maxPages?: number;
};

type AccessTokenResolver = (tenant: TenantContext) => Promise<string>;

export type SyncQueueProcessResult = {
  processed: number;
  succeeded: number;
  partial: number;
  retried: number;
  failed: number;
  continued: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max);
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function errorCode(error: unknown): string {
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

  if (error instanceof GitHubNotConnectedError) {
    return "GITHUB_NOT_CONNECTED";
  }

  if (error instanceof RepositoryNotTrackedError) {
    return "REPOSITORY_NOT_TRACKED";
  }

  if (error instanceof RepositorySyncInProgressError) {
    return "SYNC_IN_PROGRESS";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return "DATABASE_ERROR";
  }

  return "UNKNOWN";
}

function errorMessage(error: unknown): string {
  if (error instanceof GitHubCommitError) {
    return error.message;
  }

  if (error instanceof GitHubNotConnectedError) {
    return "GitHub is not connected for this account";
  }

  if (error instanceof RepositoryNotTrackedError) {
    return error.message;
  }

  if (error instanceof RepositorySyncInProgressError) {
    return error.message;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return "Could not save sync results";
  }

  return "Sync failed";
}

function backoffMs(attempts: number): number {
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
  const jitter = Math.floor(Math.random() * Math.max(1, exponential * 0.2));

  return exponential + jitter;
}

function retryDelayMs(error: unknown, attempts: number): number | null {
  if (error instanceof GitHubCommitError && error.code === "RATE_LIMIT") {
    const retryAfter = (error.retryAfterSeconds ?? 60) * 1000;

    return Math.max(retryAfter, backoffMs(attempts));
  }

  if (error instanceof GitHubCommitError) {
    return error.code === "UNAVAILABLE" || error.code === "INVALID_RESPONSE"
      ? backoffMs(attempts)
      : null;
  }

  if (error instanceof RepositorySyncInProgressError) {
    return Math.max(60_000, backoffMs(attempts));
  }

  if (
    error instanceof GitHubNotConnectedError ||
    error instanceof RepositoryNotTrackedError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
  ) {
    return null;
  }

  return backoffMs(attempts);
}

function fairOrder<T extends { userId: string }>(items: T[], perUserLimit: number): T[] {
  const byUser = new Map<string, T[]>();

  for (const item of items) {
    const queue = byUser.get(item.userId) ?? [];
    queue.push(item);
    byUser.set(item.userId, queue);
  }

  const ordered: T[] = [];
  const counts = new Map<string, number>();
  let added = true;

  while (added) {
    added = false;

    for (const [userId, queue] of byUser) {
      const count = counts.get(userId) ?? 0;

      if (queue.length === 0 || count >= perUserLimit) {
        continue;
      }

      ordered.push(queue.shift() as T);
      counts.set(userId, count + 1);
      added = true;
    }
  }

  return ordered;
}

export function createSyncQueueService(
  db: AppPrismaClient,
  options: {
    commitClient?: GitHubCommitLister;
    getAccessToken?: AccessTokenResolver;
    maxAttempts?: number;
  } = {},
) {
  const commitClient = options.commitClient ?? createGitHubCommitClient();
  const getAccessToken =
    options.getAccessToken ?? ((tenant: TenantContext) => getDecryptedAccessToken(db, tenant));
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sync = createRepositorySyncService(db, commitClient);

  async function enqueue(input: EnqueueInput) {
    const availableAt = input.availableAt ?? new Date();

    try {
      const run = await db.syncRun.create({
        data: {
          userId: input.userId,
          userRepositoryId: input.userRepositoryId,
          trigger: input.trigger,
          status: "PENDING",
          availableAt,
          dedupeKey: input.dedupeKey ?? null,
        },
      });

      return { run, created: true, requeued: false };
    } catch (error) {
      if (!isUniqueConstraintError(error) || !input.dedupeKey) {
        throw error;
      }

      const existing = await db.syncRun.findUnique({
        where: { dedupeKey: input.dedupeKey },
      });

      if (!existing) {
        throw error;
      }

      if (
        existing.status === "FAILED" &&
        existing.attempts < maxAttempts &&
        existing.userRepositoryId
      ) {
        const run = await db.syncRun.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            availableAt,
            lockedAt: null,
            finishedAt: null,
            errorCode: null,
            errorMessage: null,
          },
        });

        return { run, created: false, requeued: true };
      }

      return { run: existing, created: false, requeued: false };
    }
  }

  async function enqueueRepositoryWebhook(
    githubRepositoryId: string,
    deliveryId: string,
    now = new Date(),
  ) {
    const connections = await db.userRepository.findMany({
      where: {
        githubRepositoryId,
        trackingEnabled: true,
        user: {
          accounts: {
            some: {
              provider: GITHUB_PROVIDER,
              disconnectedAt: null,
              access_token: { not: null },
            },
          },
        },
      },
      select: { id: true, userId: true },
    });
    let enqueued = 0;

    for (const connection of connections) {
      const result = await enqueue({
        userId: connection.userId,
        userRepositoryId: connection.id,
        trigger: "WEBHOOK",
        dedupeKey: `webhook:${deliveryId}:${connection.id}`,
        availableAt: now,
      });

      if (result.created || result.requeued) {
        enqueued += 1;
      }
    }

    return { connections: connections.length, enqueued };
  }

  async function enqueueDueScheduledSyncs(input: ScheduledSyncOptions = {}) {
    const now = input.now ?? new Date();
    const intervalHours = Math.max(input.intervalHours ?? DEFAULT_SYNC_INTERVAL_HOURS, 1);
    const perUserLimit = clamp(input.perUserLimit ?? DEFAULT_PER_USER_LIMIT, 1, 10);
    const limit = clamp(input.limit ?? 50, 1, 200);
    const cutoff = new Date(now.getTime() - intervalHours * HOUR_MS);
    const connections = await db.userRepository.findMany({
      where: {
        trackingEnabled: true,
        user: {
          accounts: {
            some: {
              provider: GITHUB_PROVIDER,
              disconnectedAt: null,
              access_token: { not: null },
            },
          },
        },
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }, { syncStatus: "FAILED" }],
      },
      select: { id: true, userId: true, lastSyncedAt: true },
      orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      take: Math.min(limit * perUserLimit * 10, 1000),
    });
    const window = Math.floor(now.getTime() / (intervalHours * HOUR_MS));
    const counts = new Map<string, number>();
    let enqueued = 0;

    for (const connection of fairOrder(connections, perUserLimit)) {
      if (enqueued >= limit) {
        break;
      }

      const count = counts.get(connection.userId) ?? 0;

      if (count >= perUserLimit) {
        continue;
      }

      const active = await db.syncRun.findFirst({
        where: {
          userId: connection.userId,
          userRepositoryId: connection.id,
          status: { in: ["PENDING", "RUNNING"] },
        },
        select: { id: true },
      });

      if (active) {
        continue;
      }

      const result = await enqueue({
        userId: connection.userId,
        userRepositoryId: connection.id,
        trigger: "SCHEDULED",
        dedupeKey: `scheduled:${connection.id}:${window}`,
        availableAt: now,
      });

      if (result.created || result.requeued) {
        enqueued += 1;
        counts.set(connection.userId, count + 1);
      }
    }

    return { enqueued, candidates: connections.length };
  }

  async function processPending(input: ProcessOptions = {}): Promise<SyncQueueProcessResult> {
    const now = input.now ?? new Date();
    const limit = clamp(input.limit ?? DEFAULT_PROCESS_LIMIT, 1, 25);
    const perUserLimit = clamp(input.perUserLimit ?? DEFAULT_PER_USER_LIMIT, 1, 10);
    const maxPages = clamp(input.maxPages ?? DEFAULT_MAX_PAGES, 1, 100);
    const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);

    await db.syncRun.updateMany({
      where: {
        status: "RUNNING",
        userRepositoryId: { not: null },
        lockedAt: { lt: staleBefore },
      },
      data: {
        status: "PENDING",
        availableAt: now,
        lockedAt: null,
        errorCode: "STALE_QUEUE_LOCK",
        errorMessage: "Recovered a stale queue lock",
      },
    });

    const candidates = await db.syncRun.findMany({
      where: {
        status: "PENDING",
        availableAt: { lte: now },
        userRepositoryId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        userRepositoryId: true,
        trigger: true,
        attempts: true,
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      take: Math.min(limit * perUserLimit * 10, 1000),
    });
    const result: SyncQueueProcessResult = {
      processed: 0,
      succeeded: 0,
      partial: 0,
      retried: 0,
      failed: 0,
      continued: 0,
    };

    for (const candidate of fairOrder(candidates, perUserLimit)) {
      if (result.processed >= limit || !candidate.userRepositoryId) {
        break;
      }

      const claim = await db.syncRun.updateMany({
        where: {
          id: candidate.id,
          status: "PENDING",
          availableAt: { lte: now },
        },
        data: {
          status: "RUNNING",
          startedAt: now,
          lockedAt: now,
          attempts: { increment: 1 },
        },
      });

      if (claim.count === 0) {
        continue;
      }

      result.processed += 1;
      const tenant = createTenantContext(candidate.userId);

      try {
        const accessToken = await getAccessToken(tenant);
        const syncResult = await sync.sync(tenant, candidate.userRepositoryId, accessToken, {
          syncRunId: candidate.id,
          trigger: candidate.trigger,
          maxPages,
          now,
        });

        if (syncResult.hasMore) {
          result.partial += 1;

          const continuation = await enqueue({
            userId: candidate.userId,
            userRepositoryId: candidate.userRepositoryId,
            trigger: "SCHEDULED",
            dedupeKey: `continue:${candidate.id}`,
            availableAt: now,
          });

          if (continuation.created || continuation.requeued) {
            result.continued += 1;
          }
        } else {
          result.succeeded += 1;
        }
      } catch (error) {
        const attempts = candidate.attempts + 1;
        const delay = retryDelayMs(error, attempts);
        const code = errorCode(error);
        const message = errorMessage(error);

        if (delay !== null && attempts < maxAttempts) {
          await db.syncRun.update({
            where: { id: candidate.id },
            data: {
              status: "PENDING",
              availableAt: new Date(now.getTime() + delay),
              lockedAt: null,
              finishedAt: null,
              errorCode: code,
              errorMessage: message,
            },
          });
          await db.userRepository.updateMany({
            where: {
              id: candidate.userRepositoryId,
              userId: candidate.userId,
            },
            data: { syncStatus: "PENDING" },
          });
          result.retried += 1;
        } else {
          await db.syncRun.update({
            where: { id: candidate.id },
            data: {
              status: "FAILED",
              finishedAt: now,
              lockedAt: null,
              errorCode: code,
              errorMessage: message,
            },
          });
          await db.userRepository.updateMany({
            where: {
              id: candidate.userRepositoryId,
              userId: candidate.userId,
            },
            data: { syncStatus: "FAILED" },
          });
          result.failed += 1;
        }
      }
    }

    return result;
  }

  return {
    enqueue,
    enqueueRepositoryWebhook,
    enqueueDueScheduledSyncs,
    processPending,
  };
}

export type SyncQueueService = ReturnType<typeof createSyncQueueService>;
