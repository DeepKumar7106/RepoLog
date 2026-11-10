import { randomUUID } from "node:crypto";
import { createPrismaClient, type AppPrismaClient } from "@/lib/db/prisma-factory";

export function getTestPrisma(): AppPrismaClient {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error("TEST_DATABASE_URL is required for integration tests");
  }

  return createPrismaClient(url);
}

export async function resetTestDatabase(prisma: AppPrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "User", "GitHubRepository" RESTART IDENTITY CASCADE',
  );
}

export async function createTenantFixture(prisma: AppPrismaClient) {
  const suffix = randomUUID().slice(0, 8);

  const user = await prisma.user.create({
    data: {
      githubUserId: `gh-${suffix}`,
      githubLogin: `user-${suffix}`,
      displayName: `User ${suffix}`,
      profileSlug: `user-${suffix}`,
      profileVisibility: "PRIVATE",
    },
  });

  const repository = await prisma.gitHubRepository.create({
    data: {
      githubRepositoryId: `repo-${suffix}`,
      ownerLogin: `owner-${suffix}`,
      ownerType: "USER",
      name: `repo-${suffix}`,
      fullName: `owner-${suffix}/repo-${suffix}`,
      htmlUrl: `https://github.com/owner-${suffix}/repo-${suffix}`,
      visibility: "PUBLIC",
      defaultBranch: "main",
    },
  });

  const userRepository = await prisma.userRepository.create({
    data: {
      userId: user.id,
      githubRepositoryId: repository.id,
      trackingEnabled: true,
    },
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      userRepositoryId: userRepository.id,
      slug: `project-${suffix}`,
      displayTitle: `Project ${suffix}`,
      visibility: "PRIVATE",
    },
  });

  const syncRun = await prisma.syncRun.create({
    data: {
      userId: user.id,
      userRepositoryId: userRepository.id,
      trigger: "INITIAL",
      status: "SUCCEEDED",
    },
  });

  return {
    suffix,
    user,
    repository,
    userRepository,
    project,
    syncRun,
  };
}

export type TenantFixture = Awaited<ReturnType<typeof createTenantFixture>>;
