import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import {
  GitHubCommitError,
  type GitHubCommit,
  type GitHubCommitLister,
} from "@/lib/github/commits";
import {
  createTenantContext,
  TenantAccessDeniedError,
  type TenantContext,
} from "@/lib/tenancy/tenant-context";
import {
  createRepositorySyncService,
  RepositoryNotTrackedError,
  RepositorySyncInProgressError,
} from "@/server/services/repository-sync-service";
import {
  createTenantFixture,
  getTestPrisma,
  resetTestDatabase,
  type TenantFixture,
} from "../helpers/db";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

function commitFor(
  sha: string,
  options: {
    authorId?: number;
    email?: string;
    name?: string;
    date?: string;
  } = {},
): GitHubCommit {
  const date = options.date ?? "2026-01-01T10:00:00.000Z";

  return {
    sha,
    html_url: `https://github.com/owner/repo/commit/${sha}`,
    commit: {
      message: `Commit ${sha}`,
      author: {
        name: options.name ?? "Alice",
        email: options.email ?? "alice@example.com",
        date,
      },
      committer: { date },
    },
    author: options.authorId ? { id: options.authorId, login: "alice" } : null,
  };
}

function lister(pages: GitHubCommit[][]): GitHubCommitLister {
  return {
    listPage: async (_accessToken, _owner, _name, options) => ({
      commits: pages[options.page - 1] ?? [],
      page: options.page,
      nextPage: options.page < pages.length ? options.page + 1 : null,
    }),
  };
}

describe.skipIf(!hasTestDatabase)("repository sync", () => {
  let prisma: AppPrismaClient;
  let fixture: TenantFixture;
  let tenant: TenantContext;

  beforeAll(() => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
    fixture = await createTenantFixture(prisma);
    tenant = createTenantContext(fixture.user.id);

    await prisma.user.update({
      where: { id: fixture.user.id },
      data: { githubUserId: "123" },
    });
    await prisma.authorEmail.create({
      data: {
        userId: fixture.user.id,
        email: "alice@example.com",
        verifiedByUser: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("backfills matching commits in resumable pages and updates project activity", async () => {
    const service = createRepositorySyncService(
      prisma,
      lister([
        [
          commitFor("a", { authorId: 123 }),
          commitFor("b", { authorId: 999, email: "alice@example.com" }),
        ],
        [
          commitFor("c", { authorId: 999, email: "stranger@example.com" }),
          commitFor("d", { authorId: 123, date: "2026-01-02T10:00:00.000Z" }),
        ],
      ]),
    );

    const first = await service.sync(tenant, fixture.userRepository.id, "token", {
      maxPages: 1,
      perPage: 2,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(first).toMatchObject({
      mode: "BACKFILL",
      status: "PARTIAL",
      syncStatus: "PARTIAL",
      backfillStatus: "IN_PROGRESS",
      pagesProcessed: 1,
      commitsProcessed: 2,
      commitsInserted: 2,
      hasMore: true,
      lastSyncedAt: null,
    });

    const afterFirst = await prisma.userRepository.findUniqueOrThrow({
      where: { id: fixture.userRepository.id },
    });

    expect(afterFirst.backfillCursor).toBe("2");
    expect(afterFirst.lastSyncedAt).toBeNull();

    const commitsAfterFirst = await prisma.commit.findMany({
      where: { userRepositoryId: fixture.userRepository.id },
      orderBy: { sha: "asc" },
    });

    expect(commitsAfterFirst.map((commit) => commit.sha)).toEqual(["a", "b"]);
    expect(commitsAfterFirst.map((commit) => commit.authorMatchMethod)).toEqual([
      "GITHUB_USER",
      "VERIFIED_EMAIL",
    ]);

    const second = await service.sync(tenant, fixture.userRepository.id, "token", {
      maxPages: 1,
      perPage: 2,
      now: new Date("2026-01-02T01:00:00.000Z"),
    });

    expect(second).toMatchObject({
      mode: "BACKFILL",
      status: "SUCCEEDED",
      syncStatus: "SUCCEEDED",
      backfillStatus: "COMPLETE",
      pagesProcessed: 1,
      commitsProcessed: 2,
      commitsInserted: 1,
      hasMore: false,
      lastSyncedAt: "2026-01-02T01:00:00.000Z",
    });

    const afterSecond = await prisma.userRepository.findUniqueOrThrow({
      where: { id: fixture.userRepository.id },
    });

    expect(afterSecond.backfillCursor).toBeNull();
    expect(afterSecond.syncCursor).toBe("2026-01-02T01:00:00.000Z");

    const allCommits = await prisma.commit.findMany({
      where: { userRepositoryId: fixture.userRepository.id },
      orderBy: { sha: "asc" },
    });

    expect(allCommits.map((commit) => commit.sha)).toEqual(["a", "b", "d"]);

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: fixture.project.id },
    });

    expect(project.firstCommitAt?.toISOString()).toBe("2026-01-01T10:00:00.000Z");
    expect(project.latestCommitAt?.toISOString()).toBe("2026-01-02T10:00:00.000Z");

    const activities = await prisma.dailyProjectActivity.findMany({
      where: { projectId: fixture.project.id },
      orderBy: { date: "asc" },
    });

    expect(activities.map((activity) => activity.commitCount)).toEqual([2, 1]);

    const firstRun = await prisma.syncRun.findUniqueOrThrow({
      where: { id: first.syncRunId },
    });

    expect(firstRun).toMatchObject({
      trigger: "INITIAL",
      status: "PARTIAL",
      pagesProcessed: 1,
      commitsProcessed: 2,
      commitsInserted: 2,
    });

    const secondRun = await prisma.syncRun.findUniqueOrThrow({
      where: { id: second.syncRunId },
    });

    expect(secondRun).toMatchObject({
      trigger: "ADMIN",
      status: "SUCCEEDED",
      pagesProcessed: 1,
      commitsProcessed: 2,
      commitsInserted: 1,
    });
  });

  it("uses an overlapping date cursor for incremental syncs", async () => {
    await prisma.userRepository.update({
      where: { id: fixture.userRepository.id },
      data: {
        backfillStatus: "COMPLETE",
        syncStatus: "SUCCEEDED",
        syncCursor: "2026-01-03T00:00:00.000Z",
        lastSyncedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    });

    let receivedSince: string | undefined;
    const service = createRepositorySyncService(prisma, {
      listPage: async (_accessToken, _owner, _name, options) => {
        receivedSince = options.since;

        return {
          commits: [commitFor("e", { authorId: 123, date: "2026-01-03T10:00:00.000Z" })],
          page: options.page,
          nextPage: null,
        };
      },
    });

    const result = await service.sync(tenant, fixture.userRepository.id, "token", {
      now: new Date("2026-01-04T00:00:00.000Z"),
    });

    expect(receivedSince).toBe("2026-01-02T00:00:00.000Z");
    expect(result).toMatchObject({
      mode: "INCREMENTAL",
      status: "SUCCEEDED",
      commitsInserted: 1,
      hasMore: false,
    });

    const connection = await prisma.userRepository.findUniqueOrThrow({
      where: { id: fixture.userRepository.id },
    });

    expect(connection.syncCursor).toBe("2026-01-04T00:00:00.000Z");
    expect(connection.lastSyncedAt?.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });

  it("rejects a concurrent sync while a fresh run is active", async () => {
    await prisma.userRepository.update({
      where: { id: fixture.userRepository.id },
      data: { syncStatus: "RUNNING" },
    });

    const service = createRepositorySyncService(
      prisma,
      lister([[commitFor("a", { authorId: 123 })]]),
    );

    await expect(
      service.sync(tenant, fixture.userRepository.id, "token", { now: new Date() }),
    ).rejects.toBeInstanceOf(RepositorySyncInProgressError);
  });

  it("requires tracking before syncing", async () => {
    await prisma.userRepository.update({
      where: { id: fixture.userRepository.id },
      data: { trackingEnabled: false },
    });

    const service = createRepositorySyncService(
      prisma,
      lister([[commitFor("a", { authorId: 123 })]]),
    );

    await expect(service.sync(tenant, fixture.userRepository.id, "token")).rejects.toBeInstanceOf(
      RepositoryNotTrackedError,
    );
  });

  it("treats an empty GitHub repository as a completed backfill", async () => {
    const service = createRepositorySyncService(prisma, {
      listPage: async () => {
        throw new GitHubCommitError("EMPTY", "GitHub repository has no commits");
      },
    });

    const result = await service.sync(tenant, fixture.userRepository.id, "token", {
      now: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      syncStatus: "SUCCEEDED",
      backfillStatus: "COMPLETE",
      pagesProcessed: 0,
      commitsProcessed: 0,
      commitsInserted: 0,
      hasMore: false,
    });
  });

  it("records a failed run and safe error code", async () => {
    const service = createRepositorySyncService(prisma, {
      listPage: async () => {
        throw new GitHubCommitError("RATE_LIMIT", "GitHub rate limit reached", {
          retryAfterSeconds: 60,
          pagesProcessed: 0,
        });
      },
    });

    await expect(service.sync(tenant, fixture.userRepository.id, "token")).rejects.toMatchObject({
      code: "RATE_LIMIT",
    });

    const connection = await prisma.userRepository.findUniqueOrThrow({
      where: { id: fixture.userRepository.id },
    });

    expect(connection.syncStatus).toBe("FAILED");
    expect(connection.backfillStatus).toBe("FAILED");

    const run = await prisma.syncRun.findFirstOrThrow({
      where: {
        userId: tenant.userId,
        userRepositoryId: fixture.userRepository.id,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(run).toMatchObject({
      status: "FAILED",
      errorCode: "GITHUB_RATE_LIMIT",
      errorMessage: "GitHub rate limit reached",
      pagesProcessed: 0,
    });
  });

  it("does not sync another tenant's repository", async () => {
    const otherFixture = await createTenantFixture(prisma);
    const service = createRepositorySyncService(
      prisma,
      lister([[commitFor("a", { authorId: 123 })]]),
    );

    await expect(
      service.sync(tenant, otherFixture.userRepository.id, "token"),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);
  });
});
