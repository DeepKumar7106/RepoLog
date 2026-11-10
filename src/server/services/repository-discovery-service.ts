import { Prisma, type OwnerType, type RepositoryVisibility } from "@/generated/prisma/client";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import {
  createGitHubRepositoryClient,
  GitHubRepositoryError,
  type GitHubRepository,
  type GitHubRepositoryLister,
} from "@/lib/github/repositories";
import type { TenantContext } from "@/lib/tenancy/tenant-context";

export type RepositoryDiscoveryResult = {
  discovered: number;
  created: number;
  updated: number;
  pages: number;
  lastDiscoveredAt: string;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function toOwnerType(ownerType: string): OwnerType {
  return ownerType.toLowerCase() === "organization" ? "ORGANIZATION" : "USER";
}

function toRepositoryVisibility(repository: GitHubRepository): RepositoryVisibility {
  if (repository.visibility === "public") {
    return "PUBLIC";
  }

  if (!repository.visibility && !repository.private) {
    return "PUBLIC";
  }

  return "PRIVATE";
}

function discoveryErrorCode(error: unknown): string {
  if (error instanceof GitHubRepositoryError) {
    switch (error.code) {
      case "AUTH":
        return "GITHUB_AUTH";
      case "RATE_LIMIT":
        return "GITHUB_RATE_LIMIT";
      case "UNAVAILABLE":
        return "GITHUB_UNAVAILABLE";
      case "INVALID_RESPONSE":
        return "GITHUB_INVALID_RESPONSE";
      case "PAGINATION_LIMIT":
        return "GITHUB_PAGINATION_LIMIT";
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return "DATABASE_ERROR";
  }

  return "UNKNOWN";
}

function discoveryErrorMessage(error: unknown): string {
  if (error instanceof GitHubRepositoryError) {
    return error.message;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return "Could not save discovered repositories";
  }

  return "Repository discovery failed";
}

export function createRepositoryDiscoveryService(
  db: AppPrismaClient,
  client: GitHubRepositoryLister = createGitHubRepositoryClient(),
) {
  async function upsertRepository(repository: GitHubRepository, now: Date) {
    const metadata = {
      ownerLogin: repository.owner.login,
      ownerType: toOwnerType(repository.owner.type),
      name: repository.name,
      fullName: repository.full_name,
      description: repository.description ?? null,
      htmlUrl: repository.html_url,
      visibility: toRepositoryVisibility(repository),
      defaultBranch: repository.default_branch,
      isArchived: repository.archived ?? false,
      isFork: repository.fork ?? false,
      lastMetadataRefreshAt: now,
    };

    return db.gitHubRepository.upsert({
      where: { githubRepositoryId: String(repository.id) },
      update: metadata,
      create: {
        githubRepositoryId: String(repository.id),
        ...metadata,
      },
      select: { id: true },
    });
  }

  return {
    async discover(tenant: TenantContext, accessToken: string): Promise<RepositoryDiscoveryResult> {
      const now = new Date();
      const run = await db.syncRun.create({
        data: {
          userId: tenant.userId,
          trigger: "ADMIN",
          status: "RUNNING",
        },
      });

      try {
        const { repositories, pages } = await client.listAll(accessToken);
        const githubRepositoryIds: string[] = [];

        for (const batch of chunk(repositories, 20)) {
          const upserted = await Promise.all(
            batch.map((repository) => upsertRepository(repository, now)),
          );

          githubRepositoryIds.push(...upserted.map((record) => record.id));
        }

        let created = 0;

        if (githubRepositoryIds.length > 0) {
          const createResult = await db.userRepository.createMany({
            data: githubRepositoryIds.map((githubRepositoryId) => ({
              userId: tenant.userId,
              githubRepositoryId,
              firstDiscoveredAt: now,
              lastDiscoveredAt: now,
            })),
            skipDuplicates: true,
          });

          created = createResult.count;

          await db.userRepository.updateMany({
            where: {
              userId: tenant.userId,
              githubRepositoryId: { in: githubRepositoryIds },
            },
            data: { lastDiscoveredAt: now },
          });
        }

        await db.syncRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCEEDED",
            finishedAt: new Date(),
            pagesProcessed: pages,
          },
        });

        return {
          discovered: repositories.length,
          created,
          updated: githubRepositoryIds.length - created,
          pages,
          lastDiscoveredAt: now.toISOString(),
        };
      } catch (error) {
        const pagesProcessed =
          error instanceof GitHubRepositoryError ? (error.pagesProcessed ?? 0) : 0;

        await db.syncRun
          .update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              finishedAt: new Date(),
              pagesProcessed,
              errorCode: discoveryErrorCode(error),
              errorMessage: discoveryErrorMessage(error),
            },
          })
          .catch(() => undefined);

        throw error;
      }
    },
  };
}

export type RepositoryDiscoveryService = ReturnType<typeof createRepositoryDiscoveryService>;
