import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { GitHubRepositoryError, type GitHubRepository } from "@/lib/github/repositories";
import { createRepositoryDiscoveryService } from "@/server/services/repository-discovery-service";
import { createSyncQueueService } from "@/server/services/sync-queue-service";

const repositorySchema = z.object({
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
    .transform((value) => value ?? undefined),
  archived: z.boolean().optional(),
  fork: z.boolean().optional(),
});

const pushPayloadSchema = z.object({
  ref: z.string().min(1),
  deleted: z.boolean().optional(),
  repository: repositorySchema,
});

const repositoryPayloadSchema = z.object({
  action: z.string().min(1),
  repository: repositorySchema,
});

type RepositoryPayload = z.infer<typeof repositorySchema>;

type StoredRepository = {
  defaultBranch: string;
  description: string | null;
  htmlUrl: string;
  visibility: "PUBLIC" | "PRIVATE";
  isArchived: boolean;
  isFork: boolean;
};

export type GitHubWebhookResult = {
  deliveryId: string;
  event: string;
  status: "processed" | "ignored" | "duplicate";
  connections: number;
  enqueued: number;
};

const STALE_PROCESSING_MS = 15 * 60 * 1000;

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toGitHubRepository(
  repository: RepositoryPayload,
  stored: StoredRepository | null,
): GitHubRepository {
  return {
    id: repository.id,
    name: repository.name,
    full_name: repository.full_name,
    owner: repository.owner,
    description: repository.description ?? stored?.description ?? null,
    html_url: repository.html_url,
    private: repository.private,
    visibility: repository.visibility,
    default_branch: repository.default_branch ?? stored?.defaultBranch ?? "main",
    archived: repository.archived ?? stored?.isArchived ?? false,
    fork: repository.fork ?? stored?.isFork ?? false,
  };
}

export function createGitHubWebhookService(
  db: AppPrismaClient,
  dependencies: {
    queue?: ReturnType<typeof createSyncQueueService>;
    discovery?: ReturnType<typeof createRepositoryDiscoveryService>;
  } = {},
) {
  const queue = dependencies.queue ?? createSyncQueueService(db);
  const discovery = dependencies.discovery ?? createRepositoryDiscoveryService(db);

  async function beginDelivery(input: {
    deliveryId: string;
    event: string;
    action: string | null;
    repositoryGithubId: string | null;
  }): Promise<{ duplicate: boolean; attempts: number }> {
    try {
      await db.gitHubWebhookDelivery.create({
        data: {
          deliveryId: input.deliveryId,
          event: input.event,
          action: input.action,
          repositoryGithubId: input.repositoryGithubId,
          status: "PROCESSING",
          attempts: 1,
        },
      });

      return { duplicate: false, attempts: 1 };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await db.gitHubWebhookDelivery.findUnique({
        where: { deliveryId: input.deliveryId },
      });

      if (!existing) {
        throw error;
      }

      const stale = existing.updatedAt < new Date(Date.now() - STALE_PROCESSING_MS);

      if (existing.status !== "FAILED" && !(existing.status === "PROCESSING" && stale)) {
        return { duplicate: true, attempts: existing.attempts };
      }

      const claimed = await db.gitHubWebhookDelivery.updateMany({
        where: {
          id: existing.id,
          OR: [
            { status: "FAILED" },
            { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
          ],
        },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          errorCode: null,
          errorMessage: null,
        },
      });

      if (claimed.count === 0) {
        return { duplicate: true, attempts: existing.attempts };
      }

      return { duplicate: false, attempts: existing.attempts + 1 };
    }
  }

  async function finishDelivery(
    deliveryId: string,
    status: "PROCESSED" | "IGNORED" | "FAILED",
    error?: unknown,
  ) {
    await db.gitHubWebhookDelivery.updateMany({
      where: { deliveryId },
      data: {
        status,
        processedAt: status === "FAILED" ? null : new Date(),
        errorCode: error === undefined ? null : "WEBHOOK_FAILED",
        errorMessage:
          error instanceof GitHubRepositoryError
            ? error.message.slice(0, 500)
            : error === undefined
              ? null
              : "Webhook processing failed",
      },
    });
  }

  async function enqueueRepository(repositoryId: string, deliveryId: string, now: Date) {
    return queue.enqueueRepositoryWebhook(repositoryId, deliveryId, now);
  }

  return {
    async handle(input: {
      deliveryId: string;
      event: string;
      payload: unknown;
      now?: Date;
    }): Promise<GitHubWebhookResult> {
      const now = input.now ?? new Date();
      const payloadRecord =
        input.payload && typeof input.payload === "object"
          ? (input.payload as Record<string, unknown>)
          : {};
      const rawRepository = payloadRecord.repository;
      const repositoryGithubId =
        rawRepository && typeof rawRepository === "object" && "id" in rawRepository
          ? String((rawRepository as { id: unknown }).id)
          : null;
      const rawAction = payloadRecord.action;
      const action = typeof rawAction === "string" ? rawAction : null;
      const delivery = await beginDelivery({
        deliveryId: input.deliveryId,
        event: input.event,
        action,
        repositoryGithubId,
      });

      if (delivery.duplicate) {
        return {
          deliveryId: input.deliveryId,
          event: input.event,
          status: "duplicate",
          connections: 0,
          enqueued: 0,
        };
      }

      try {
        if (input.event === "ping") {
          await finishDelivery(input.deliveryId, "IGNORED");

          return {
            deliveryId: input.deliveryId,
            event: input.event,
            status: "ignored",
            connections: 0,
            enqueued: 0,
          };
        }

        if (input.event === "push") {
          const parsed = pushPayloadSchema.safeParse(input.payload);

          if (!parsed.success) {
            await finishDelivery(input.deliveryId, "IGNORED");

            return {
              deliveryId: input.deliveryId,
              event: input.event,
              status: "ignored",
              connections: 0,
              enqueued: 0,
            };
          }

          const stored = await db.gitHubRepository.findUnique({
            where: { githubRepositoryId: String(parsed.data.repository.id) },
            select: {
              id: true,
              defaultBranch: true,
              description: true,
              htmlUrl: true,
              visibility: true,
              isArchived: true,
              isFork: true,
            },
          });

          if (!stored) {
            await finishDelivery(input.deliveryId, "IGNORED");

            return {
              deliveryId: input.deliveryId,
              event: input.event,
              status: "ignored",
              connections: 0,
              enqueued: 0,
            };
          }

          const repository = toGitHubRepository(parsed.data.repository, stored);

          if (parsed.data.ref !== `refs/heads/${repository.default_branch}`) {
            await finishDelivery(input.deliveryId, "IGNORED");

            return {
              deliveryId: input.deliveryId,
              event: input.event,
              status: "ignored",
              connections: 0,
              enqueued: 0,
            };
          }

          const saved = await discovery.refreshMetadata(repository, now);
          const enqueueResult = await enqueueRepository(saved.id, input.deliveryId, now);
          await finishDelivery(input.deliveryId, "PROCESSED");

          return {
            deliveryId: input.deliveryId,
            event: input.event,
            status: "processed",
            connections: enqueueResult.connections,
            enqueued: enqueueResult.enqueued,
          };
        }

        if (input.event === "repository") {
          const parsed = repositoryPayloadSchema.safeParse(input.payload);

          if (!parsed.success) {
            await finishDelivery(input.deliveryId, "IGNORED");

            return {
              deliveryId: input.deliveryId,
              event: input.event,
              status: "ignored",
              connections: 0,
              enqueued: 0,
            };
          }

          const stored = await db.gitHubRepository.findUnique({
            where: { githubRepositoryId: String(parsed.data.repository.id) },
            select: {
              defaultBranch: true,
              description: true,
              htmlUrl: true,
              visibility: true,
              isArchived: true,
              isFork: true,
            },
          });
          const deleted = parsed.data.action === "deleted";
          const repository = toGitHubRepository(
            {
              ...parsed.data.repository,
              archived: deleted ? true : parsed.data.repository.archived,
            },
            stored,
          );
          const saved = await discovery.refreshMetadata(repository, now);

          if (deleted) {
            await finishDelivery(input.deliveryId, "IGNORED");

            return {
              deliveryId: input.deliveryId,
              event: input.event,
              status: "ignored",
              connections: 0,
              enqueued: 0,
            };
          }

          const enqueueResult = await enqueueRepository(saved.id, input.deliveryId, now);
          await finishDelivery(input.deliveryId, "PROCESSED");

          return {
            deliveryId: input.deliveryId,
            event: input.event,
            status: "processed",
            connections: enqueueResult.connections,
            enqueued: enqueueResult.enqueued,
          };
        }

        await finishDelivery(input.deliveryId, "IGNORED");

        return {
          deliveryId: input.deliveryId,
          event: input.event,
          status: "ignored",
          connections: 0,
          enqueued: 0,
        };
      } catch (error) {
        await finishDelivery(input.deliveryId, "FAILED", error).catch(() => undefined);
        throw error;
      }
    },
  };
}

export type GitHubWebhookService = ReturnType<typeof createGitHubWebhookService>;
