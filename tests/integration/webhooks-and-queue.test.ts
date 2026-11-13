import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import {
  GitHubCommitError,
  type GitHubCommit,
  type GitHubCommitLister,
} from "@/lib/github/commits";
import { createGitHubWebhookService } from "@/server/services/github-webhook-service";
import { createRepositoryDiscoveryService } from "@/server/services/repository-discovery-service";
import { createSyncQueueService } from "@/server/services/sync-queue-service";
import {
  createTenantFixture,
  getTestPrisma,
  resetTestDatabase,
  type TenantFixture,
} from "../helpers/db";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

function commitFor(sha: string): GitHubCommit {
  const date = "2026-01-01T10:00:00.000Z";

  return {
    sha,
    html_url: `https://github.com/owner/repo/commit/${sha}`,
    commit: {
      message: `Commit ${sha}`,
      author: {
        name: "Alice",
        email: "alice@example.com",
        date,
      },
      committer: { date },
    },
    author: { id: 123, login: "alice" },
  };
}

function webhookRepository(overrides: Record<string, unknown> = {}) {
  return {
    id: 12345,
    name: "repo",
    full_name: "owner/repo",
    owner: { login: "owner", type: "User" },
    description: "A repository",
    html_url: "https://github.com/owner/repo",
    private: false,
    visibility: "public",
    default_branch: "main",
    archived: false,
    fork: false,
    ...overrides,
  };
}

describe.skipIf(!hasTestDatabase)("GitHub webhooks and sync queue", () => {
  let prisma: AppPrismaClient;
  let fixture: TenantFixture;

  beforeAll(() => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
    fixture = await createTenantFixture(prisma);

    await prisma.user.update({
      where: { id: fixture.user.id },
      data: { githubUserId: "123", onboardingCompletedAt: new Date() },
    });
    await prisma.gitHubRepository.update({
      where: { id: fixture.repository.id },
      data: { githubRepositoryId: "12345" },
    });
    await prisma.account.create({
      data: {
        userId: fixture.user.id,
        type: "oauth",
        provider: "github",
        providerAccountId: "123",
        access_token: "stored-token",
        scope: "repo",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("verifies delivery idempotency and ignores non-default branch pushes", async () => {
    const queue = createSyncQueueService(prisma, {
      commitClient: { listPage: async () => ({ commits: [], page: 1, nextPage: null }) },
      getAccessToken: async () => "token",
    });
    const webhook = createGitHubWebhookService(prisma, { queue });
    const now = new Date("2026-01-02T00:00:00.000Z");
    const payload = {
      ref: "refs/heads/main",
      repository: webhookRepository(),
    };

    const first = await webhook.handle({
      deliveryId: "delivery-1",
      event: "push",
      payload,
      now,
    });

    expect(first).toMatchObject({
      status: "processed",
      connections: 1,
      enqueued: 1,
    });

    const duplicate = await webhook.handle({
      deliveryId: "delivery-1",
      event: "push",
      payload,
      now,
    });

    expect(duplicate.status).toBe("duplicate");
    expect(
      await prisma.syncRun.count({
        where: { userRepositoryId: fixture.userRepository.id, trigger: "WEBHOOK" },
      }),
    ).toBe(1);

    const ignored = await webhook.handle({
      deliveryId: "delivery-2",
      event: "push",
      payload: { ...payload, ref: "refs/heads/feature" },
      now,
    });

    expect(ignored.status).toBe("ignored");
    expect(
      await prisma.syncRun.count({
        where: { userRepositoryId: fixture.userRepository.id, trigger: "WEBHOOK" },
      }),
    ).toBe(1);
  });

  it("updates repository metadata from a repository webhook", async () => {
    const queue = createSyncQueueService(prisma, {
      commitClient: { listPage: async () => ({ commits: [], page: 1, nextPage: null }) },
      getAccessToken: async () => "token",
    });
    const webhook = createGitHubWebhookService(prisma, { queue });
    const result = await webhook.handle({
      deliveryId: "delivery-rename",
      event: "repository",
      payload: {
        action: "renamed",
        repository: webhookRepository({
          name: "renamed",
          full_name: "new-owner/renamed",
          owner: { login: "new-owner", type: "User" },
          html_url: "https://github.com/new-owner/renamed",
        }),
      },
    });

    expect(result).toMatchObject({ status: "processed", connections: 1, enqueued: 1 });

    const saved = await prisma.gitHubRepository.findUniqueOrThrow({
      where: { id: fixture.repository.id },
    });

    expect(saved.name).toBe("renamed");
    expect(saved.ownerLogin).toBe("new-owner");
    expect(saved.fullName).toBe("new-owner/renamed");
  });

  it("retries rate-limited syncs with backoff and then succeeds", async () => {
    let calls = 0;
    const commitClient: GitHubCommitLister = {
      listPage: async (_token, _owner, _name, options) => {
        calls += 1;

        if (calls === 1) {
          throw new GitHubCommitError("RATE_LIMIT", "GitHub rate limit reached", {
            status: 429,
            retryAfterSeconds: 60,
          });
        }

        return {
          commits: [commitFor("a")],
          page: options.page,
          nextPage: null,
        };
      },
    };
    const queue = createSyncQueueService(prisma, {
      commitClient,
      getAccessToken: async () => "token",
    });
    const base = new Date("2026-01-02T00:00:00.000Z");

    await queue.enqueue({
      userId: fixture.user.id,
      userRepositoryId: fixture.userRepository.id,
      trigger: "WEBHOOK",
      dedupeKey: "webhook:retry:1",
      availableAt: base,
    });

    const first = await queue.processPending({ now: base, limit: 1, perUserLimit: 1 });
    expect(first).toMatchObject({ processed: 1, retried: 1, succeeded: 0 });

    const retried = await prisma.syncRun.findFirstOrThrow({
      where: { userRepositoryId: fixture.userRepository.id, trigger: "WEBHOOK" },
    });

    expect(retried.status).toBe("PENDING");
    expect(retried.attempts).toBe(1);
    expect(retried.availableAt.getTime()).toBeGreaterThan(base.getTime());

    const second = await queue.processPending({
      now: new Date(base.getTime() + 120_000),
      limit: 1,
      perUserLimit: 1,
      maxPages: 1,
    });

    expect(second).toMatchObject({ processed: 1, succeeded: 1, retried: 0 });

    const completed = await prisma.syncRun.findUniqueOrThrow({ where: { id: retried.id } });

    expect(completed.status).toBe("SUCCEEDED");
    expect(completed.attempts).toBe(2);
    expect(
      await prisma.commit.count({ where: { userRepositoryId: fixture.userRepository.id } }),
    ).toBe(1);
  });

  it("runs a webhook push through the queue into activity data", async () => {
    const queue = createSyncQueueService(prisma, {
      commitClient: {
        listPage: async (_token, _owner, _name, options) => ({
          commits: [commitFor("e2e")],
          page: options.page,
          nextPage: null,
        }),
      },
      getAccessToken: async () => "token",
    });
    const webhook = createGitHubWebhookService(prisma, { queue });
    const now = new Date("2026-01-02T00:00:00.000Z");

    const delivery = await webhook.handle({
      deliveryId: "delivery-e2e",
      event: "push",
      payload: {
        ref: "refs/heads/main",
        repository: webhookRepository(),
      },
      now,
    });

    expect(delivery).toMatchObject({ status: "processed", enqueued: 1 });

    const processed = await queue.processPending({ now, limit: 1, perUserLimit: 1 });

    expect(processed).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
    expect(
      await prisma.commit.count({ where: { userRepositoryId: fixture.userRepository.id } }),
    ).toBe(1);
    expect(
      await prisma.dailyProjectActivity.count({ where: { projectId: fixture.project.id } }),
    ).toBe(1);

    const run = await prisma.syncRun.findFirstOrThrow({
      where: { userRepositoryId: fixture.userRepository.id, trigger: "WEBHOOK" },
    });

    expect(run.status).toBe("SUCCEEDED");
  });

  it("finds users due for scheduled discovery", async () => {
    const discovery = createRepositoryDiscoveryService(prisma);
    const now = new Date("2026-01-02T00:00:00.000Z");

    expect((await discovery.listDueUsers({ now })).map((user) => user.userId)).toContain(
      fixture.user.id,
    );

    await prisma.syncRun.create({
      data: {
        userId: fixture.user.id,
        trigger: "SCHEDULED",
        status: "SUCCEEDED",
        startedAt: now,
      },
    });

    expect((await discovery.listDueUsers({ now })).map((user) => user.userId)).not.toContain(
      fixture.user.id,
    );
  });

  it("enqueues due scheduled syncs once per interval window", async () => {
    const queue = createSyncQueueService(prisma, {
      commitClient: { listPage: async () => ({ commits: [], page: 1, nextPage: null }) },
      getAccessToken: async () => "token",
    });
    const now = new Date("2026-01-02T00:00:00.000Z");

    const first = await queue.enqueueDueScheduledSyncs({ now });
    const second = await queue.enqueueDueScheduledSyncs({ now });

    expect(first.enqueued).toBe(1);
    expect(second.enqueued).toBe(0);
    expect(
      await prisma.syncRun.count({
        where: { userRepositoryId: fixture.userRepository.id, trigger: "SCHEDULED" },
      }),
    ).toBe(1);
  });
});
