import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import {
  GitHubRepositoryError,
  type GitHubRepository,
  type GitHubRepositoryLister,
} from "@/lib/github/repositories";
import { createTenantContext, type TenantContext } from "@/lib/tenancy/tenant-context";
import { createRepositoryDiscoveryService } from "@/server/services/repository-discovery-service";
import { createUserRepositoryService } from "@/server/services/user-repository-service";
import {
  createTenantFixture,
  getTestPrisma,
  resetTestDatabase,
  type TenantFixture,
} from "../helpers/db";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

function repository(id: number, overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id,
    name: `repo-${id}`,
    full_name: `owner/repo-${id}`,
    owner: { login: "owner", type: "User" },
    description: null,
    html_url: `https://github.com/owner/repo-${id}`,
    private: false,
    visibility: "public",
    default_branch: "main",
    archived: false,
    fork: false,
    ...overrides,
  };
}

function lister(repositories: GitHubRepository[], pages = 1): GitHubRepositoryLister {
  return {
    listAll: async () => ({ repositories, pages }),
  };
}

describe.skipIf(!hasTestDatabase)("repository discovery", () => {
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates repository connections and a successful discovery run", async () => {
    const discovery = createRepositoryDiscoveryService(
      prisma,
      lister([repository(101), repository(102)]),
    );

    const result = await discovery.discover(tenant, "token");

    expect(result).toMatchObject({
      discovered: 2,
      created: 2,
      updated: 0,
      pages: 1,
    });

    const connections = await prisma.userRepository.findMany({
      where: { userId: tenant.userId },
      include: { githubRepository: true },
      orderBy: { githubRepository: { fullName: "asc" } },
    });

    expect(connections).toHaveLength(3);
    expect(connections.map((connection) => connection.githubRepository.fullName)).toEqual([
      `owner-${fixture.suffix}/repo-${fixture.suffix}`,
      "owner/repo-101",
      "owner/repo-102",
    ]);

    const run = await prisma.syncRun.findFirst({
      where: { userId: tenant.userId, userRepositoryId: null },
      orderBy: { createdAt: "desc" },
    });

    expect(run).toMatchObject({
      trigger: "ADMIN",
      status: "SUCCEEDED",
      pagesProcessed: 1,
    });
    expect(run?.finishedAt).toBeInstanceOf(Date);
  });

  it("is idempotent and preserves per-user selection settings", async () => {
    const discovery = createRepositoryDiscoveryService(
      prisma,
      lister([repository(201), repository(202)]),
    );

    await discovery.discover(tenant, "token");

    const firstConnection = await prisma.userRepository.findFirstOrThrow({
      where: { userId: tenant.userId },
      orderBy: { createdAt: "asc" },
    });

    await prisma.userRepository.update({
      where: { id: firstConnection.id },
      data: { trackingEnabled: false, publicDisplayEnabled: true },
    });

    const secondResult = await discovery.discover(tenant, "token");

    expect(secondResult).toMatchObject({
      discovered: 2,
      created: 0,
      updated: 2,
    });

    const connections = await prisma.userRepository.findMany({
      where: { userId: tenant.userId },
    });

    expect(connections).toHaveLength(3);

    const preserved = connections.find((connection) => connection.id === firstConnection.id);
    expect(preserved?.trackingEnabled).toBe(false);
    expect(preserved?.publicDisplayEnabled).toBe(true);

    const runs = await prisma.syncRun.count({
      where: { userId: tenant.userId, userRepositoryId: null },
    });

    expect(runs).toBe(2);
  });

  it("records a failed run and rethrows the discovery error", async () => {
    const discovery = createRepositoryDiscoveryService(prisma, {
      listAll: async () => {
        throw new GitHubRepositoryError("RATE_LIMIT", "GitHub rate limit reached", {
          retryAfterSeconds: 60,
          pagesProcessed: 1,
        });
      },
    });

    await expect(discovery.discover(tenant, "token")).rejects.toMatchObject({
      code: "RATE_LIMIT",
    });

    const run = await prisma.syncRun.findFirst({
      where: { userId: tenant.userId, userRepositoryId: null },
      orderBy: { createdAt: "desc" },
    });

    expect(run).toMatchObject({
      status: "FAILED",
      errorCode: "GITHUB_RATE_LIMIT",
      errorMessage: "GitHub rate limit reached",
      pagesProcessed: 1,
    });
  });

  it("lists and filters repositories with pagination", async () => {
    const discovery = createRepositoryDiscoveryService(
      prisma,
      lister([
        repository(301, {
          name: "alpha-app",
          full_name: "alpha/alpha-app",
          owner: { login: "alpha", type: "User" },
          private: true,
          visibility: "private",
        }),
        repository(302, {
          name: "beta-service",
          full_name: "beta/beta-service",
          owner: { login: "beta", type: "Organization" },
        }),
      ]),
    );

    await discovery.discover(tenant, "token");

    const userRepositories = createUserRepositoryService(prisma);
    const firstPage = await userRepositories.listPage(tenant, { perPage: 2, page: 1 });

    expect(firstPage.total).toBe(3);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.records).toHaveLength(2);

    const secondPage = await userRepositories.listPage(tenant, { perPage: 2, page: 2 });
    expect(secondPage.records).toHaveLength(1);

    const organizations = await userRepositories.listPage(tenant, { ownerType: "ORGANIZATION" });
    expect(organizations.records.map((record) => record.githubRepository.fullName)).toEqual([
      "beta/beta-service",
    ]);

    const search = await userRepositories.listPage(tenant, { q: "alpha" });
    expect(search.records.map((record) => record.githubRepository.fullName)).toEqual([
      "alpha/alpha-app",
    ]);

    const tracked = await userRepositories.listPage(tenant, { tracking: true });
    expect(tracked.total).toBe(1);

    const counts = await userRepositories.counts(tenant);
    expect(counts).toEqual({ total: 3, tracked: 1, publicDisplay: 0 });
  });

  it("does not bulk-update another tenant's repositories", async () => {
    const otherFixture = await createTenantFixture(prisma);
    const userRepositories = createUserRepositoryService(prisma);

    const updated = await userRepositories.updateMany(tenant, { trackingEnabled: false }, [
      otherFixture.userRepository.id,
    ]);

    expect(updated).toBe(0);

    const otherRepository = await prisma.userRepository.findUniqueOrThrow({
      where: { id: otherFixture.userRepository.id },
    });

    expect(otherRepository.trackingEnabled).toBe(true);
  });
});
