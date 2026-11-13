import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";
import { getTestDatabaseUrl } from "./env";

export function getE2EPrisma(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: getTestDatabaseUrl() }),
  });
}

export async function resetE2EDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "User", "GitHubRepository", "GitHubWebhookDelivery" RESTART IDENTITY CASCADE',
  );
}

export async function seedE2EProfile(prisma: PrismaClient) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const user = await prisma.user.create({
    data: {
      githubUserId: "e2e-public",
      githubLogin: "e2e-public",
      displayName: "E2E Public",
      profileSlug: "e2e-public",
      profileBio: "E2E public profile bio",
      profileVisibility: "PUBLIC",
      searchIndexingEnabled: true,
      timezone: "Asia/Kolkata",
      onboardingCompletedAt: now,
    },
  });

  const privateUser = await prisma.user.create({
    data: {
      githubUserId: "e2e-private",
      githubLogin: "e2e-private",
      displayName: "E2E Private",
      profileSlug: "e2e-private",
      profileVisibility: "PRIVATE",
      onboardingCompletedAt: now,
    },
  });

  const repository = await prisma.gitHubRepository.create({
    data: {
      githubRepositoryId: "e2e-repository",
      ownerLogin: "e2e-owner",
      ownerType: "USER",
      name: "e2e-repository",
      fullName: "e2e-owner/e2e-repository",
      description: "E2E repository description",
      htmlUrl: "https://github.com/e2e-owner/e2e-repository",
      visibility: "PUBLIC",
      defaultBranch: "main",
    },
  });

  const userRepository = await prisma.userRepository.create({
    data: {
      userId: user.id,
      githubRepositoryId: repository.id,
      trackingEnabled: true,
      publicDisplayEnabled: true,
      publicActivityDetail: "COMMIT_DETAILS",
      lastSyncedAt: now,
      syncStatus: "IDLE",
      backfillStatus: "COMPLETE",
    },
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      userRepositoryId: userRepository.id,
      slug: "e2e-project",
      displayTitle: "E2E Project",
      shortDescription: "A public end-to-end project",
      status: "ONGOING",
      visibility: "PUBLIC",
      publicReadmeMarkdown: "# E2E project\n\nPublic README content.",
      firstCommitAt: now,
      latestCommitAt: now,
    },
  });

  await prisma.commit.create({
    data: {
      userId: user.id,
      userRepositoryId: userRepository.id,
      sha: "e2e-commit-sha",
      authorGithubUserId: "e2e-public",
      authorLogin: "e2e-public",
      authorName: "E2E Public",
      authorEmail: "e2e-public@example.com",
      authorDate: now,
      committerDate: now,
      message: "E2E commit message",
      htmlUrl: "https://github.com/e2e-owner/e2e-repository/commit/e2e-commit-sha",
      authorMatchMethod: "GITHUB_USER",
      isOnDefaultBranch: true,
    },
  });

  await prisma.dailyProjectActivity.create({
    data: {
      userId: user.id,
      projectId: project.id,
      date,
      timezone: user.timezone,
      commitCount: 1,
      firstCommitAt: now,
      lastCommitAt: now,
    },
  });

  return { user, privateUser, repository, userRepository, project };
}

export async function createE2ESession(prisma: PrismaClient, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const sessionToken = createHash("sha256").update(token, "utf8").digest("base64url");

  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return token;
}
