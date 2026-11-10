import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import {
  createTenantContext,
  TenantAccessDeniedError,
  type TenantContext,
} from "@/lib/tenancy/tenant-context";
import { createProjectService } from "@/server/services/project-service";
import { createPublicProfileService } from "@/server/services/public-profile-service";
import { createSyncRunService } from "@/server/services/sync-run-service";
import { createUserRepositoryService } from "@/server/services/user-repository-service";
import {
  createTenantFixture,
  getTestPrisma,
  resetTestDatabase,
  type TenantFixture,
} from "../helpers/db";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("tenant isolation", () => {
  let prisma: AppPrismaClient;
  let tenantA: TenantContext;
  let tenantB: TenantContext;
  let fixtureA: TenantFixture;
  let fixtureB: TenantFixture;

  let userRepositories: ReturnType<typeof createUserRepositoryService>;
  let projects: ReturnType<typeof createProjectService>;
  let syncRuns: ReturnType<typeof createSyncRunService>;
  let publicProfiles: ReturnType<typeof createPublicProfileService>;

  beforeAll(async () => {
    prisma = getTestPrisma();
    await resetTestDatabase(prisma);

    fixtureA = await createTenantFixture(prisma);
    fixtureB = await createTenantFixture(prisma);

    tenantA = createTenantContext(fixtureA.user.id);
    tenantB = createTenantContext(fixtureB.user.id);

    userRepositories = createUserRepositoryService(prisma);
    projects = createProjectService(prisma);
    syncRuns = createSyncRunService(prisma);
    publicProfiles = createPublicProfileService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("user repositories", () => {
    it("lists only the tenant's own repositories", async () => {
      const records = await userRepositories.list(tenantA);

      expect(records.map((record) => record.id)).toEqual([fixtureA.userRepository.id]);
    });

    it("denies reading another tenant's repository by guessed id", async () => {
      await expect(
        userRepositories.get(tenantA, fixtureB.userRepository.id),
      ).rejects.toBeInstanceOf(TenantAccessDeniedError);
    });

    it("denies updating another tenant's repository", async () => {
      await expect(
        userRepositories.update(tenantA, fixtureB.userRepository.id, {
          trackingEnabled: false,
        }),
      ).rejects.toBeInstanceOf(TenantAccessDeniedError);

      const record = await prisma.userRepository.findUniqueOrThrow({
        where: { id: fixtureB.userRepository.id },
      });

      expect(record.trackingEnabled).toBe(true);
    });

    it("updates the tenant's own repository", async () => {
      const record = await userRepositories.update(tenantA, fixtureA.userRepository.id, {
        trackingEnabled: false,
      });

      expect(record.trackingEnabled).toBe(false);
    });
  });

  describe("projects", () => {
    it("lists only the tenant's own projects", async () => {
      const records = await projects.list(tenantA);

      expect(records.map((record) => record.id)).toEqual([fixtureA.project.id]);
    });

    it("denies reading another tenant's project", async () => {
      await expect(projects.get(tenantA, fixtureB.project.id)).rejects.toBeInstanceOf(
        TenantAccessDeniedError,
      );
    });

    it("denies updating another tenant's project", async () => {
      await expect(
        projects.update(tenantA, fixtureB.project.id, { displayTitle: "Hijacked" }),
      ).rejects.toBeInstanceOf(TenantAccessDeniedError);

      const record = await prisma.project.findUniqueOrThrow({
        where: { id: fixtureB.project.id },
      });

      expect(record.displayTitle).toBe(fixtureB.project.displayTitle);
    });
  });

  describe("sync runs", () => {
    it("lists only the tenant's own sync runs", async () => {
      const records = await syncRuns.list(tenantA);

      expect(records.map((record) => record.id)).toEqual([fixtureA.syncRun.id]);
    });

    it("refuses to start a sync run for another tenant's repository", async () => {
      await expect(
        syncRuns.start(tenantA, {
          userRepositoryId: fixtureB.userRepository.id,
          trigger: "ADMIN",
        }),
      ).rejects.toBeInstanceOf(TenantAccessDeniedError);
    });

    it("starts a sync run for the tenant's own repository", async () => {
      const record = await syncRuns.start(tenantA, {
        userRepositoryId: fixtureA.userRepository.id,
        trigger: "ADMIN",
      });

      expect(record.userId).toBe(fixtureA.user.id);
      expect(record.userRepositoryId).toBe(fixtureA.userRepository.id);
    });
  });

  describe("public visibility", () => {
    it("does not return a private profile", async () => {
      expect(await publicProfiles.findProfileBySlug(fixtureA.user.profileSlug)).toBeNull();
    });

    it("does not expose a public project when the owning profile is private", async () => {
      await prisma.project.update({
        where: { id: fixtureA.project.id },
        data: { visibility: "PUBLIC" },
      });
      await prisma.userRepository.update({
        where: { id: fixtureA.userRepository.id },
        data: { publicDisplayEnabled: true },
      });

      expect(
        await publicProfiles.findProjectBySlugs(fixtureA.user.profileSlug, fixtureA.project.slug),
      ).toBeNull();
    });

    it("returns a public project but omits private repository metadata", async () => {
      await prisma.user.update({
        where: { id: fixtureB.user.id },
        data: { profileVisibility: "PUBLIC" },
      });
      await prisma.project.update({
        where: { id: fixtureB.project.id },
        data: { visibility: "PUBLIC" },
      });
      await prisma.userRepository.update({
        where: { id: fixtureB.userRepository.id },
        data: { publicDisplayEnabled: true },
      });
      await prisma.gitHubRepository.update({
        where: { id: fixtureB.repository.id },
        data: { visibility: "PRIVATE" },
      });

      const profile = await publicProfiles.findProfileBySlug(fixtureB.user.profileSlug);
      expect(profile?.projects.map((project) => project.slug)).toEqual([fixtureB.project.slug]);

      const project = await publicProfiles.findProjectBySlugs(
        fixtureB.user.profileSlug,
        fixtureB.project.slug,
      );

      expect(project).not.toBeNull();
      expect(project?.repository).toBeNull();
    });

    it("returns repository metadata for a public repository", async () => {
      await prisma.gitHubRepository.update({
        where: { id: fixtureB.repository.id },
        data: { visibility: "PUBLIC" },
      });

      const project = await publicProfiles.findProjectBySlugs(
        fixtureB.user.profileSlug,
        fixtureB.project.slug,
      );

      expect(project?.repository?.fullName).toBe(fixtureB.repository.fullName);
    });
  });

  describe("tenant B remains independent", () => {
    it("still sees only its own repository after tenant A activity", async () => {
      const records = await userRepositories.list(tenantB);

      expect(records.map((record) => record.id)).toEqual([fixtureB.userRepository.id]);
    });
  });
});
