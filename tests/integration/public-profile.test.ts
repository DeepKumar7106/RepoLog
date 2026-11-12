import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { dateKeyToUtcDate } from "@/lib/time/dates";
import { createActivityService } from "@/server/services/activity-service";
import { createPublicProfileService } from "@/server/services/public-profile-service";
import {
  createTenantFixture,
  getTestPrisma,
  resetTestDatabase,
  type TenantFixture,
} from "../helpers/db";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const ACTIVITY_DATE = "2026-01-15";

async function makeProfilePublic(prisma: AppPrismaClient, fixture: TenantFixture) {
  return prisma.user.update({
    where: { id: fixture.user.id },
    data: {
      profileVisibility: "PUBLIC",
      profileBio: "Public builder",
      timezone: "UTC",
      searchIndexingEnabled: true,
    },
  });
}

async function makeProjectPublic(
  prisma: AppPrismaClient,
  fixture: TenantFixture,
  activityDetail: "HIDDEN" | "AGGREGATED" | "COMMIT_DETAILS",
) {
  await prisma.userRepository.update({
    where: { id: fixture.userRepository.id },
    data: {
      publicDisplayEnabled: true,
      publicActivityDetail: activityDetail,
    },
  });
  await prisma.project.update({
    where: { id: fixture.project.id },
    data: {
      visibility: "PUBLIC",
      shortDescription: "A public project",
      publicReadmeMarkdown: "# Public overview",
      firstCommitAt: dateKeyToUtcDate(ACTIVITY_DATE),
      latestCommitAt: dateKeyToUtcDate(ACTIVITY_DATE),
    },
  });
}

async function createActivity(
  prisma: AppPrismaClient,
  fixture: TenantFixture,
  options: { commitCount?: number; timezone?: string; date?: string } = {},
) {
  const timezone = options.timezone ?? "UTC";
  const date = options.date ?? ACTIVITY_DATE;

  return prisma.dailyProjectActivity.create({
    data: {
      userId: fixture.user.id,
      projectId: fixture.project.id,
      date: dateKeyToUtcDate(date),
      timezone,
      commitCount: options.commitCount ?? 2,
      additions: 10,
      deletions: 3,
      changedFiles: 4,
      firstCommitAt: new Date(`${date}T12:00:00.000Z`),
      lastCommitAt: new Date(`${date}T13:00:00.000Z`),
    },
  });
}

async function createCommit(
  prisma: AppPrismaClient,
  fixture: TenantFixture,
  options: { sha?: string; authorDate?: Date } = {},
) {
  return prisma.commit.create({
    data: {
      userId: fixture.user.id,
      userRepositoryId: fixture.userRepository.id,
      sha: options.sha ?? `sha-${fixture.suffix}`,
      authorName: "User",
      authorEmail: "user@example.com",
      authorDate: options.authorDate ?? new Date(`${ACTIVITY_DATE}T12:00:00.000Z`),
      committerDate: options.authorDate ?? new Date(`${ACTIVITY_DATE}T12:00:00.000Z`),
      message: "Implement public activity",
      htmlUrl: `https://github.com/example/repo/commit/${options.sha ?? fixture.suffix}`,
      authorMatchMethod: "GITHUB_USER",
      isOnDefaultBranch: true,
    },
  });
}

describe.skipIf(!hasTestDatabase)("public profile and activity", () => {
  let prisma: AppPrismaClient;
  let fixture: TenantFixture;
  let publicProfiles: ReturnType<typeof createPublicProfileService>;
  let activity: ReturnType<typeof createActivityService>;

  beforeAll(() => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
    fixture = await createTenantFixture(prisma);
    publicProfiles = createPublicProfileService(prisma);
    activity = createActivityService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("hides private profiles, projects, activity and days", async () => {
    await expect(publicProfiles.findProfileBySlug(fixture.user.profileSlug)).resolves.toBeNull();
    await expect(
      publicProfiles.findProjectBySlugs(fixture.user.profileSlug, fixture.project.slug),
    ).resolves.toBeNull();
    await expect(publicProfiles.getActivity(fixture.user.profileSlug)).resolves.toBeNull();
    await expect(
      publicProfiles.getDay(fixture.user.profileSlug, ACTIVITY_DATE),
    ).resolves.toBeNull();
  });

  it("returns public profile, project and commit details for public repositories", async () => {
    await makeProfilePublic(prisma, fixture);
    await makeProjectPublic(prisma, fixture, "COMMIT_DETAILS");
    await createActivity(prisma, fixture);
    await createCommit(prisma, fixture);

    const profile = await publicProfiles.findProfileBySlug(fixture.user.profileSlug);
    const project = await publicProfiles.findProjectBySlugs(
      fixture.user.profileSlug,
      fixture.project.slug,
    );
    const summary = await publicProfiles.getActivity(fixture.user.profileSlug, {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    const day = await publicProfiles.getDay(fixture.user.profileSlug, ACTIVITY_DATE);

    expect(profile).toMatchObject({
      profileSlug: fixture.user.profileSlug,
      profileBio: "Public builder",
      searchIndexingEnabled: true,
    });
    expect(profile?.projects).toHaveLength(1);
    expect(project?.readmeMarkdown).toBe("# Public overview");
    expect(project?.repository?.fullName).toBe(fixture.repository.fullName);
    expect(summary?.totals).toMatchObject({ commits: 2, activeDays: 1, projectCount: 1 });
    expect(summary?.days[0]).toMatchObject({
      date: ACTIVITY_DATE,
      commitCount: 2,
      projectCount: 1,
    });
    expect(day).toMatchObject({ date: ACTIVITY_DATE, timezone: "UTC", totalCommits: 2 });
    expect(day?.commits).toHaveLength(1);
    expect(day?.commits[0].message).toBe("Implement public activity");
    expect(day?.projects[0]).toMatchObject({ commitCount: 2, additions: 10, changedFiles: 4 });
  });

  it("returns aggregates without commit details when activity is aggregated", async () => {
    await makeProfilePublic(prisma, fixture);
    await makeProjectPublic(prisma, fixture, "AGGREGATED");
    await createActivity(prisma, fixture);
    await createCommit(prisma, fixture);

    const day = await publicProfiles.getDay(fixture.user.profileSlug, ACTIVITY_DATE);

    expect(day?.totalCommits).toBe(2);
    expect(day?.commits).toHaveLength(0);
  });

  it("hides repository metadata and commit details for private repositories", async () => {
    await makeProfilePublic(prisma, fixture);
    await makeProjectPublic(prisma, fixture, "COMMIT_DETAILS");
    await prisma.gitHubRepository.update({
      where: { id: fixture.repository.id },
      data: { visibility: "PRIVATE" },
    });
    await createActivity(prisma, fixture);
    await createCommit(prisma, fixture);

    const project = await publicProfiles.findProjectBySlugs(
      fixture.user.profileSlug,
      fixture.project.slug,
    );
    const day = await publicProfiles.getDay(fixture.user.profileSlug, ACTIVITY_DATE);

    expect(project?.repository).toBeNull();
    expect(day?.totalCommits).toBe(2);
    expect(day?.commits).toHaveLength(0);
  });

  it("excludes private projects and disabled public display from public data", async () => {
    await makeProfilePublic(prisma, fixture);
    await makeProjectPublic(prisma, fixture, "COMMIT_DETAILS");
    await createActivity(prisma, fixture);
    await prisma.project.update({
      where: { id: fixture.project.id },
      data: { visibility: "PRIVATE" },
    });

    const profile = await publicProfiles.findProfileBySlug(fixture.user.profileSlug);
    const summary = await publicProfiles.getActivity(fixture.user.profileSlug, {
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(profile?.projects).toHaveLength(0);
    expect(summary?.days).toHaveLength(0);

    await prisma.project.update({
      where: { id: fixture.project.id },
      data: { visibility: "PUBLIC" },
    });
    await prisma.userRepository.update({
      where: { id: fixture.userRepository.id },
      data: { publicDisplayEnabled: false },
    });

    const hiddenSummary = await publicProfiles.getActivity(fixture.user.profileSlug, {
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(hiddenSummary?.days).toHaveLength(0);
  });

  it("uses the profile timezone when assigning commits to a day", async () => {
    await prisma.user.update({
      where: { id: fixture.user.id },
      data: { profileVisibility: "PUBLIC", timezone: "Asia/Kolkata" },
    });
    await makeProjectPublic(prisma, fixture, "COMMIT_DETAILS");
    await createActivity(prisma, fixture, { timezone: "Asia/Kolkata" });
    await createCommit(prisma, fixture, {
      authorDate: new Date("2026-01-14T20:00:00.000Z"),
    });

    const day = await publicProfiles.getDay(fixture.user.profileSlug, ACTIVITY_DATE);

    expect(day?.commits).toHaveLength(1);
    expect(day?.timezone).toBe("Asia/Kolkata");
  });

  it("returns null for an unknown project filter", async () => {
    await makeProfilePublic(prisma, fixture);
    await makeProjectPublic(prisma, fixture, "COMMIT_DETAILS");

    await expect(
      publicProfiles.getActivity(fixture.user.profileSlug, { projectSlug: "missing" }),
    ).resolves.toBeNull();
  });

  it("shows private activity to the authenticated dashboard", async () => {
    const tenant = createTenantContext(fixture.user.id);
    await createActivity(prisma, fixture, { timezone: fixture.user.timezone });
    await createCommit(prisma, fixture);

    const summary = await activity.summary(tenant, {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    const day = await activity.day(tenant, ACTIVITY_DATE);

    expect(summary?.totals).toMatchObject({ commits: 2, activeDays: 1, projectCount: 1 });
    expect(day?.totalCommits).toBe(2);
    expect(day?.commits).toHaveLength(1);
  });
});
