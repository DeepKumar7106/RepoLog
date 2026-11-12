import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import type { SummaryInput, SummaryProvider } from "@/lib/summaries/types";
import { createTenantContext } from "@/lib/tenancy/tenant-context";
import { dateKeyToUtcDate } from "@/lib/time/dates";
import { createProjectService } from "@/server/services/project-service";
import { createSummaryService } from "@/server/services/summary-service";
import { createUserSettingsService } from "@/server/services/user-settings-service";
import {
  createTenantFixture,
  getTestPrisma,
  resetTestDatabase,
  type TenantFixture,
} from "../helpers/db";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const SUMMARY_DATE = "2026-01-15";
const NOW = new Date("2026-01-16T12:00:00.000Z");

type CapturingProvider = SummaryProvider & {
  inputs: SummaryInput[];
};

function createCapturingProvider(
  output?: (input: SummaryInput) => Awaited<ReturnType<SummaryProvider["generate"]>>,
): CapturingProvider {
  const inputs: SummaryInput[] = [];
  const provider: CapturingProvider = {
    name: "test",
    model: "test-model",
    inputs,
    async generate(input) {
      inputs.push(input);

      return output
        ? output(input)
        : {
            headline: `Worked on ${input.projects.length} project${input.projects.length === 1 ? "" : "s"}`,
            summary: `Made ${input.totalCommits} qualifying commits.`,
            projectHighlights: input.projects.map((project) => ({
              projectId: project.projectId,
              text: `${project.commitCount} commits`,
            })),
          };
    },
  };

  return provider;
}

async function makeSummaryReady(
  prisma: AppPrismaClient,
  fixture: TenantFixture,
  options: {
    summariesEnabled?: boolean;
    allowPrivateMetadataForLlm?: boolean;
  } = {},
) {
  await prisma.user.update({
    where: { id: fixture.user.id },
    data: { timezone: "UTC", profileVisibility: "PUBLIC" },
  });
  await prisma.userSettings.upsert({
    where: { userId: fixture.user.id },
    update: {
      summariesEnabled: options.summariesEnabled ?? true,
      allowPrivateMetadataForLlm: options.allowPrivateMetadataForLlm ?? false,
    },
    create: {
      userId: fixture.user.id,
      summariesEnabled: options.summariesEnabled ?? true,
      allowPrivateMetadataForLlm: options.allowPrivateMetadataForLlm ?? false,
    },
  });
  await prisma.userRepository.update({
    where: { id: fixture.userRepository.id },
    data: {
      backfillStatus: "COMPLETE",
      syncStatus: "IDLE",
    },
  });
}

async function makeProjectPublic(
  prisma: AppPrismaClient,
  fixture: TenantFixture,
  activityDetail: "HIDDEN" | "AGGREGATED" | "COMMIT_DETAILS" = "COMMIT_DETAILS",
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
    data: { visibility: "PUBLIC" },
  });
}

async function createActivity(
  prisma: AppPrismaClient,
  fixture: TenantFixture,
  projectId: string,
  commitCount = 2,
) {
  return prisma.dailyProjectActivity.create({
    data: {
      userId: fixture.user.id,
      projectId,
      date: dateKeyToUtcDate(SUMMARY_DATE),
      timezone: "UTC",
      commitCount,
      additions: 10,
      deletions: 3,
      changedFiles: 4,
      firstCommitAt: new Date(`${SUMMARY_DATE}T12:00:00.000Z`),
      lastCommitAt: new Date(`${SUMMARY_DATE}T13:00:00.000Z`),
    },
  });
}

async function createCommit(
  prisma: AppPrismaClient,
  fixture: TenantFixture,
  userRepositoryId: string,
  message: string,
  sha = randomUUID(),
) {
  return prisma.commit.create({
    data: {
      userId: fixture.user.id,
      userRepositoryId,
      sha,
      authorName: "User",
      authorEmail: "user@example.com",
      authorDate: new Date(`${SUMMARY_DATE}T12:00:00.000Z`),
      committerDate: new Date(`${SUMMARY_DATE}T12:00:00.000Z`),
      message,
      htmlUrl: `https://github.com/example/repo/commit/${sha}`,
      authorMatchMethod: "GITHUB_USER",
      isOnDefaultBranch: true,
    },
  });
}

async function addPrivateProject(prisma: AppPrismaClient, fixture: TenantFixture) {
  const suffix = randomUUID().slice(0, 8);
  const repository = await prisma.gitHubRepository.create({
    data: {
      githubRepositoryId: `private-repo-${suffix}`,
      ownerLogin: fixture.repository.ownerLogin,
      ownerType: "USER",
      name: `private-repo-${suffix}`,
      fullName: `${fixture.repository.ownerLogin}/private-repo-${suffix}`,
      htmlUrl: `https://github.com/${fixture.repository.ownerLogin}/private-repo-${suffix}`,
      visibility: "PRIVATE",
      defaultBranch: "main",
    },
  });
  const userRepository = await prisma.userRepository.create({
    data: {
      userId: fixture.user.id,
      githubRepositoryId: repository.id,
      trackingEnabled: true,
      backfillStatus: "COMPLETE",
      syncStatus: "IDLE",
    },
  });
  const project = await prisma.project.create({
    data: {
      userId: fixture.user.id,
      userRepositoryId: userRepository.id,
      slug: `private-project-${suffix}`,
      displayTitle: `Private project ${suffix}`,
      visibility: "PRIVATE",
    },
  });

  return { repository, userRepository, project };
}

describe.skipIf(!hasTestDatabase)("daily summaries", () => {
  let prisma: AppPrismaClient;
  let fixture: TenantFixture;

  beforeAll(() => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
    fixture = await createTenantFixture(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("generates separate public and private summaries without leaking private input", async () => {
    await makeSummaryReady(prisma, fixture, { allowPrivateMetadataForLlm: true });
    await makeProjectPublic(prisma, fixture);
    await createActivity(prisma, fixture, fixture.project.id, 2);
    await createCommit(prisma, fixture, fixture.userRepository.id, "Public work");
    const privateProject = await addPrivateProject(prisma, fixture);
    await createActivity(prisma, fixture, privateProject.project.id, 3);
    await createCommit(prisma, fixture, privateProject.userRepository.id, "Private secret work");
    const provider = createCapturingProvider();
    const summaries = createSummaryService(prisma, () => provider);
    const tenant = createTenantContext(fixture.user.id);

    const result = await summaries.generateForDate(tenant, SUMMARY_DATE, { now: NOW });

    expect(result.summaries.map((summary) => summary.scope)).toEqual(["PUBLIC", "PRIVATE"]);
    expect(result.summaries.every((summary) => summary.status === "SUCCEEDED")).toBe(true);
    expect(provider.inputs).toHaveLength(2);
    expect(provider.inputs[0].projects.map((project) => project.projectTitle)).toEqual([
      fixture.project.displayTitle,
    ]);
    expect(provider.inputs[0].projects[0].commitMessages).toEqual(["Public work"]);
    expect(provider.inputs[1].projects).toHaveLength(2);
    expect(provider.inputs[1].projects.flatMap((project) => project.commitMessages)).toEqual(
      expect.arrayContaining(["Public work", "Private secret work"]),
    );
    await expect(
      summaries.getPublicDaySummary(fixture.user.profileSlug, SUMMARY_DATE),
    ).resolves.toMatchObject({ scope: "PUBLIC", status: "SUCCEEDED" });
    await expect(summaries.getDaySummary(tenant, SUMMARY_DATE)).resolves.toMatchObject({
      scope: "PRIVATE",
      status: "SUCCEEDED",
    });
  });

  it("does not generate private summaries without the private metadata opt-in", async () => {
    await makeSummaryReady(prisma, fixture);
    const privateProject = await addPrivateProject(prisma, fixture);
    await createActivity(prisma, fixture, privateProject.project.id, 1);
    await createCommit(prisma, fixture, privateProject.userRepository.id, "Secret work");
    const provider = createCapturingProvider();
    const summaries = createSummaryService(prisma, () => provider);
    const tenant = createTenantContext(fixture.user.id);

    const result = await summaries.generateForDate(tenant, SUMMARY_DATE, { now: NOW });

    expect(result.summaries[0]).toMatchObject({
      scope: "PUBLIC",
      status: "SKIPPED",
      reason: "No qualifying activity",
    });
    expect(result.summaries[0].summary).toMatchObject({ scope: "PUBLIC", status: "SKIPPED" });
    expect(provider.inputs).toHaveLength(0);
    await expect(summaries.getDaySummary(tenant, SUMMARY_DATE)).resolves.toBeNull();
  });

  it("skips generation while repository sync is incomplete", async () => {
    await makeSummaryReady(prisma, fixture);
    await makeProjectPublic(prisma, fixture);
    await createActivity(prisma, fixture, fixture.project.id);
    await prisma.userRepository.update({
      where: { id: fixture.userRepository.id },
      data: { backfillStatus: "IN_PROGRESS" },
    });
    const provider = createCapturingProvider();
    const summaries = createSummaryService(prisma, () => provider);

    const result = await summaries.generateForDate(
      createTenantContext(fixture.user.id),
      SUMMARY_DATE,
      { now: NOW },
    );

    expect(result.summaries[0]).toMatchObject({
      status: "SKIPPED",
      reason: "Repository sync is incomplete",
    });
    expect(provider.inputs).toHaveLength(0);
  });

  it("reuses a successful summary for the same input hash", async () => {
    await makeSummaryReady(prisma, fixture);
    await makeProjectPublic(prisma, fixture);
    await createActivity(prisma, fixture, fixture.project.id);
    await createCommit(prisma, fixture, fixture.userRepository.id, "Cached work");
    const provider = createCapturingProvider();
    const summaries = createSummaryService(prisma, () => provider);
    const tenant = createTenantContext(fixture.user.id);

    await summaries.generateForDate(tenant, SUMMARY_DATE, { now: NOW });
    const second = await summaries.generateForDate(tenant, SUMMARY_DATE, { now: NOW });
    const regenerated = await summaries.generateForDate(tenant, SUMMARY_DATE, {
      now: NOW,
      force: true,
    });

    expect(provider.inputs).toHaveLength(2);
    expect(second.summaries[0].status).toBe("SUCCEEDED");
    expect(regenerated.summaries[0].status).toBe("SUCCEEDED");
    await expect(prisma.dailySummary.count({ where: { userId: fixture.user.id } })).resolves.toBe(
      1,
    );
  });

  it("stores a failed status for invalid provider output", async () => {
    await makeSummaryReady(prisma, fixture);
    await makeProjectPublic(prisma, fixture);
    await createActivity(prisma, fixture, fixture.project.id);
    const provider = createCapturingProvider(() => ({
      headline: "Invalid",
      summary: "Invalid",
      projectHighlights: [{ projectId: "not-a-project", text: "Unknown" }],
    }));
    const summaries = createSummaryService(prisma, () => provider);
    const tenant = createTenantContext(fixture.user.id);

    const result = await summaries.generateForDate(tenant, SUMMARY_DATE, { now: NOW });

    expect(result.summaries[0]).toMatchObject({
      scope: "PUBLIC",
      status: "FAILED",
    });
    await expect(
      prisma.dailySummary.findFirst({
        where: { userId: fixture.user.id, scope: "PUBLIC" },
      }),
    ).resolves.toMatchObject({
      generationStatus: "FAILED",
      errorMessage: "Summary provider returned an unknown project",
    });
  });

  it("keeps summaries isolated between users", async () => {
    await makeSummaryReady(prisma, fixture);
    await makeProjectPublic(prisma, fixture);
    await createActivity(prisma, fixture, fixture.project.id);
    const other = await createTenantFixture(prisma);
    const summaries = createSummaryService(prisma, () => createCapturingProvider());
    const tenant = createTenantContext(fixture.user.id);

    await summaries.generateForDate(tenant, SUMMARY_DATE, { now: NOW });

    await expect(
      summaries.getDaySummary(createTenantContext(other.user.id), SUMMARY_DATE),
    ).resolves.toBeNull();
    await expect(
      summaries.getPublicDaySummary(other.user.profileSlug, SUMMARY_DATE),
    ).resolves.toBeNull();
  });

  it("deletes stored summaries when summaries are disabled", async () => {
    await makeSummaryReady(prisma, fixture);
    await makeProjectPublic(prisma, fixture);
    await createActivity(prisma, fixture, fixture.project.id);
    const summaries = createSummaryService(prisma, () => createCapturingProvider());
    const tenant = createTenantContext(fixture.user.id);

    await summaries.generateForDate(tenant, SUMMARY_DATE, { now: NOW });
    await expect(prisma.dailySummary.count({ where: { userId: fixture.user.id } })).resolves.toBe(
      1,
    );

    await createUserSettingsService(prisma).update(tenant, { summariesEnabled: false });

    await expect(prisma.dailySummary.count({ where: { userId: fixture.user.id } })).resolves.toBe(
      0,
    );
  });

  it("invalidates stored summaries when project visibility changes", async () => {
    await makeSummaryReady(prisma, fixture);
    await makeProjectPublic(prisma, fixture);
    await createActivity(prisma, fixture, fixture.project.id);
    const summaries = createSummaryService(prisma, () => createCapturingProvider());
    const tenant = createTenantContext(fixture.user.id);

    await summaries.generateForDate(tenant, SUMMARY_DATE, { now: NOW });
    await expect(prisma.dailySummary.count({ where: { userId: fixture.user.id } })).resolves.toBe(
      1,
    );

    await createProjectService(prisma).update(tenant, fixture.project.id, {
      visibility: "PRIVATE",
    });

    await expect(prisma.dailySummary.count({ where: { userId: fixture.user.id } })).resolves.toBe(
      0,
    );
  });
});
