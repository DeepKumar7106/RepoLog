import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import {
  createTenantContext,
  TenantAccessDeniedError,
  type TenantContext,
} from "@/lib/tenancy/tenant-context";
import {
  createAuthorEmailService,
  AuthorEmailExistsError,
} from "@/server/services/author-email-service";
import {
  createProjectService,
  ProjectNotTrackedError,
  ProjectSlugConflictError,
} from "@/server/services/project-service";
import {
  createUserProfileService,
  ProfileSlugConflictError,
} from "@/server/services/user-profile-service";
import {
  createTenantFixture,
  getTestPrisma,
  resetTestDatabase,
  type TenantFixture,
} from "../helpers/db";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

async function createRepositoryConnection(
  prisma: AppPrismaClient,
  fixture: TenantFixture,
  options: {
    name: string;
    trackingEnabled?: boolean;
    withProject?: boolean;
  },
) {
  const repository = await prisma.gitHubRepository.create({
    data: {
      githubRepositoryId: `repo-${options.name}-${fixture.suffix}-${randomUUID().slice(0, 4)}`,
      ownerLogin: fixture.user.githubLogin,
      ownerType: "USER",
      name: options.name,
      fullName: `${fixture.user.githubLogin}/${options.name}`,
      htmlUrl: `https://github.com/${fixture.user.githubLogin}/${options.name}`,
      visibility: "PUBLIC",
      defaultBranch: "main",
    },
  });

  const connection = await prisma.userRepository.create({
    data: {
      userId: fixture.user.id,
      githubRepositoryId: repository.id,
      trackingEnabled: options.trackingEnabled ?? true,
    },
  });

  if (options.withProject) {
    await prisma.project.create({
      data: {
        userId: fixture.user.id,
        userRepositoryId: connection.id,
        slug: options.name,
        displayTitle: options.name,
      },
    });
  }

  return { repository, connection };
}

describe.skipIf(!hasTestDatabase)("project management", () => {
  let prisma: AppPrismaClient;
  let fixture: TenantFixture;
  let tenant: TenantContext;
  let projects: ReturnType<typeof createProjectService>;
  let profiles: ReturnType<typeof createUserProfileService>;
  let authorEmails: ReturnType<typeof createAuthorEmailService>;

  beforeAll(() => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
    fixture = await createTenantFixture(prisma);
    tenant = createTenantContext(fixture.user.id);
    projects = createProjectService(prisma);
    profiles = createUserProfileService(prisma);
    authorEmails = createAuthorEmailService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns the existing project for a tracked repository", async () => {
    const project = await projects.ensureForUserRepository(tenant, fixture.userRepository.id);

    expect(project.id).toBe(fixture.project.id);
    expect(await prisma.project.count({ where: { userId: fixture.user.id } })).toBe(1);
  });

  it("creates a private project for a tracked repository without one", async () => {
    const { connection } = await createRepositoryConnection(prisma, fixture, {
      name: `new-project-${fixture.suffix}`,
    });

    const project = await projects.ensureForUserRepository(tenant, connection.id);

    expect(project.userRepositoryId).toBe(connection.id);
    expect(project.visibility).toBe("PRIVATE");
    expect(project.status).toBe("ONGOING");
    expect(project.slug).toBe(`new-project-${fixture.suffix}`);
  });

  it("rejects untracked repositories and other tenants", async () => {
    const { connection } = await createRepositoryConnection(prisma, fixture, {
      name: `untracked-${fixture.suffix}`,
      trackingEnabled: false,
    });

    await expect(projects.ensureForUserRepository(tenant, connection.id)).rejects.toBeInstanceOf(
      ProjectNotTrackedError,
    );

    const otherUser = await prisma.user.create({
      data: {
        githubUserId: `gh-other-${fixture.suffix}`,
        githubLogin: `other-${fixture.suffix}`,
        profileSlug: `other-${fixture.suffix}`,
      },
    });

    await expect(
      projects.ensureForUserRepository(createTenantContext(otherUser.id), connection.id),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);
  });

  it("creates missing projects only for tracked repositories", async () => {
    await createRepositoryConnection(prisma, fixture, {
      name: `tracked-a-${fixture.suffix}`,
    });
    await createRepositoryConnection(prisma, fixture, {
      name: `tracked-b-${fixture.suffix}`,
    });
    await createRepositoryConnection(prisma, fixture, {
      name: `untracked-${fixture.suffix}`,
      trackingEnabled: false,
    });

    const created = await projects.ensureForTrackedRepositories(tenant);
    const allProjects = await prisma.project.findMany({ where: { userId: fixture.user.id } });

    expect(created).toHaveLength(2);
    expect(allProjects).toHaveLength(3);
    expect(allProjects.some((project) => project.slug === `untracked-${fixture.suffix}`)).toBe(
      false,
    );
  });

  it("uses a unique generated slug when repository names collide", async () => {
    const name = `same-name-${fixture.suffix}`;
    const first = await createRepositoryConnection(prisma, fixture, { name });
    const second = await createRepositoryConnection(prisma, fixture, { name });

    const firstProject = await projects.ensureForUserRepository(tenant, first.connection.id);
    const secondProject = await projects.ensureForUserRepository(tenant, second.connection.id);

    expect(firstProject.slug).toBe(name);
    expect(secondProject.slug).toBe(`${name}-2`);
  });

  it("updates project fields and tracks public overview changes", async () => {
    const updated = await projects.update(tenant, fixture.project.id, {
      displayTitle: "Updated title",
      shortDescription: "A public description",
      status: "COMPLETE",
      visibility: "PUBLIC",
      demoUrl: "https://example.com/demo",
      publicReadmeMarkdown: "# Public overview",
    });

    expect(updated.displayTitle).toBe("Updated title");
    expect(updated.visibility).toBe("PUBLIC");
    expect(updated.publicReadmeMarkdown).toBe("# Public overview");
    expect(updated.publicReadmeUpdatedAt).not.toBeNull();

    const overviewUpdatedAt = updated.publicReadmeUpdatedAt;

    const titleOnly = await projects.update(tenant, fixture.project.id, {
      displayTitle: "Another title",
    });

    expect(titleOnly.publicReadmeUpdatedAt?.toISOString()).toBe(overviewUpdatedAt?.toISOString());

    const sameOverview = await projects.update(tenant, fixture.project.id, {
      publicReadmeMarkdown: "# Public overview",
    });

    expect(sameOverview.publicReadmeUpdatedAt?.toISOString()).toBe(
      overviewUpdatedAt?.toISOString(),
    );

    const cleared = await projects.update(tenant, fixture.project.id, {
      publicReadmeMarkdown: null,
    });

    expect(cleared.publicReadmeMarkdown).toBeNull();
    expect(cleared.publicReadmeUpdatedAt?.toISOString()).not.toBe(overviewUpdatedAt?.toISOString());
  });

  it("rejects project slug conflicts and cross-tenant updates", async () => {
    const { connection } = await createRepositoryConnection(prisma, fixture, {
      name: `conflict-${fixture.suffix}`,
      withProject: true,
    });
    const conflictingProject = await prisma.project.findUniqueOrThrow({
      where: { userRepositoryId: connection.id },
    });

    await expect(
      projects.update(tenant, conflictingProject.id, { slug: fixture.project.slug }),
    ).rejects.toBeInstanceOf(ProjectSlugConflictError);

    const otherUser = await prisma.user.create({
      data: {
        githubUserId: `gh-other-${fixture.suffix}`,
        githubLogin: `other-${fixture.suffix}`,
        profileSlug: `other-${fixture.suffix}`,
      },
    });

    await expect(
      projects.update(createTenantContext(otherUser.id), fixture.project.id, {
        displayTitle: "Hijacked",
      }),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);
  });

  it("rejects a profile slug that belongs to another user", async () => {
    const otherUser = await prisma.user.create({
      data: {
        githubUserId: `gh-other-${fixture.suffix}`,
        githubLogin: `other-${fixture.suffix}`,
        profileSlug: `taken-${fixture.suffix}`,
      },
    });

    await expect(
      profiles.update(tenant, { profileSlug: otherUser.profileSlug }),
    ).rejects.toBeInstanceOf(ProfileSlugConflictError);
  });

  it("manages normalized verified author emails per tenant", async () => {
    const email = await authorEmails.add(tenant, "Alice@Example.com", true);

    expect(email.email).toBe("alice@example.com");
    expect(email.verifiedByUser).toBe(true);

    await expect(authorEmails.add(tenant, "alice@example.com", true)).rejects.toBeInstanceOf(
      AuthorEmailExistsError,
    );

    const unverified = await authorEmails.update(tenant, email.id, false);
    expect(unverified.verifiedByUser).toBe(false);

    const otherUser = await prisma.user.create({
      data: {
        githubUserId: `gh-other-${fixture.suffix}`,
        githubLogin: `other-${fixture.suffix}`,
        profileSlug: `other-${fixture.suffix}`,
      },
    });
    const otherTenant = createTenantContext(otherUser.id);

    await expect(authorEmails.remove(otherTenant, email.id)).rejects.toBeInstanceOf(
      TenantAccessDeniedError,
    );
    await expect(authorEmails.list(otherTenant)).resolves.toHaveLength(0);

    await authorEmails.remove(tenant, email.id);
    await expect(authorEmails.list(tenant)).resolves.toHaveLength(0);
  });
});
