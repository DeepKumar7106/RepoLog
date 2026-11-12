import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type {
  DailySummary,
  SummaryGenerationStatus,
  SummaryScope,
} from "@/generated/prisma/client";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { SummaryProviderError, createSummaryProvider } from "@/lib/summaries/provider";
import { summaryOutputSchema } from "@/lib/summaries/schema";
import type { SummaryInput, SummaryProjectInput, SummaryProvider } from "@/lib/summaries/types";
import {
  addDays,
  dateKeyToUtcDate,
  localDayQueryRange,
  todayDateKey,
  toLocalDateKey,
} from "@/lib/time/dates";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";
import { env } from "@/lib/validation/env";

export type SummaryProjectHighlightDto = {
  projectId: string;
  text: string;
};

export type DailySummaryDto = {
  id: string;
  date: string;
  timezone: string;
  scope: SummaryScope;
  headline: string | null;
  summary: string | null;
  projectHighlights: SummaryProjectHighlightDto[];
  provider: string | null;
  model: string | null;
  status: SummaryGenerationStatus;
  generatedAt: string | null;
};

export type SummaryGenerationResult = {
  scope: SummaryScope;
  status: SummaryGenerationStatus;
  reason: string | null;
  summary: DailySummaryDto | null;
};

export type SummaryGenerationResponse = {
  date: string;
  timezone: string;
  summaries: SummaryGenerationResult[];
};

export type SummaryProviderFactory = (config: {
  provider?: string | null;
  model?: string | null;
  apiKey?: string | null;
}) => SummaryProvider | null;

type SummaryProjectContext = {
  id: string;
  displayTitle: string;
  visibility: "PUBLIC" | "PRIVATE";
  userRepository: {
    id: string;
    publicDisplayEnabled: boolean;
    publicActivityDetail: "HIDDEN" | "AGGREGATED" | "COMMIT_DETAILS";
    githubRepository: {
      visibility: "PUBLIC" | "PRIVATE";
    };
  };
};

type SummaryContext = {
  timezone: string;
  settings: {
    summariesEnabled: boolean;
    allowPrivateMetadataForLlm: boolean;
    summaryProvider: string | null;
    summaryModel: string | null;
  };
  projects: SummaryProjectContext[];
};

function parseHighlights(value: Prisma.JsonValue | null): SummaryProjectHighlightDto[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      "projectId" in item &&
      "text" in item &&
      typeof item.projectId === "string" &&
      typeof item.text === "string"
    ) {
      return [{ projectId: item.projectId, text: item.text }];
    }

    return [];
  });
}

export function toDailySummaryDto(record: DailySummary): DailySummaryDto {
  return {
    id: record.id,
    date: record.date.toISOString().slice(0, 10),
    timezone: record.timezone,
    scope: record.scope,
    headline: record.headline,
    summary: record.summary,
    projectHighlights: parseHighlights(record.projectHighlights),
    provider: record.provider,
    model: record.modelName,
    status: record.generationStatus,
    generatedAt: record.generatedAt?.toISOString() ?? null,
  };
}

function isPublicProject(project: SummaryProjectContext): boolean {
  return (
    project.visibility === "PUBLIC" &&
    project.userRepository.publicDisplayEnabled &&
    project.userRepository.publicActivityDetail !== "HIDDEN"
  );
}

function isPublicCommitSafe(project: SummaryProjectContext): boolean {
  return (
    isPublicProject(project) &&
    project.userRepository.publicActivityDetail === "COMMIT_DETAILS" &&
    project.userRepository.githubRepository.visibility === "PUBLIC"
  );
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof SummaryProviderError) {
    return error.message.slice(0, 500);
  }

  return "Summary generation failed";
}

export function createSummaryService(
  db: AppPrismaClient,
  providerFactory: SummaryProviderFactory = createSummaryProvider,
) {
  async function getContext(tenant: TenantContext): Promise<SummaryContext> {
    const user = await db.user.findUnique({
      where: { id: tenant.userId },
      select: {
        timezone: true,
        settings: {
          select: {
            summariesEnabled: true,
            allowPrivateMetadataForLlm: true,
            summaryProvider: true,
            summaryModel: true,
          },
        },
        projects: {
          select: {
            id: true,
            displayTitle: true,
            visibility: true,
            userRepository: {
              select: {
                id: true,
                publicDisplayEnabled: true,
                publicActivityDetail: true,
                githubRepository: {
                  select: { visibility: true },
                },
              },
            },
          },
          orderBy: { displayTitle: "asc" },
        },
      },
    });

    if (!user) {
      throw new TenantAccessDeniedError();
    }

    return {
      timezone: user.timezone,
      settings: {
        summariesEnabled: user.settings?.summariesEnabled ?? false,
        allowPrivateMetadataForLlm: user.settings?.allowPrivateMetadataForLlm ?? false,
        summaryProvider: user.settings?.summaryProvider ?? null,
        summaryModel: user.settings?.summaryModel ?? null,
      },
      projects: user.projects,
    };
  }

  async function hasIncompleteSync(tenant: TenantContext): Promise<boolean> {
    const count = await db.userRepository.count({
      where: {
        userId: tenant.userId,
        trackingEnabled: true,
        OR: [
          {
            backfillStatus: {
              in: ["NOT_STARTED", "QUEUED", "IN_PROGRESS", "PARTIAL", "FAILED"],
            },
          },
          { syncStatus: { in: ["PENDING", "RUNNING", "FAILED", "PARTIAL"] } },
        ],
      },
    });

    return count > 0;
  }

  async function buildInput(
    tenant: TenantContext,
    context: SummaryContext,
    date: string,
    scope: SummaryScope,
  ): Promise<{ input: SummaryInput; inputHash: string }> {
    const eligibleProjects = context.projects.filter((project) =>
      scope === "PUBLIC" ? isPublicProject(project) : true,
    );
    const projectIds = eligibleProjects.map((project) => project.id);
    const rows =
      projectIds.length === 0
        ? []
        : await db.dailyProjectActivity.findMany({
            where: {
              userId: tenant.userId,
              timezone: context.timezone,
              date: dateKeyToUtcDate(date),
              projectId: { in: projectIds },
            },
            select: {
              projectId: true,
              commitCount: true,
              additions: true,
              deletions: true,
            },
          });
    const projectById = new Map(eligibleProjects.map((project) => [project.id, project]));
    const allowedCommitRepositories =
      scope === "PUBLIC" ? eligibleProjects.filter(isPublicCommitSafe) : eligibleProjects;
    const repositoryIds = allowedCommitRepositories.map((project) => project.userRepository.id);
    const projectByRepositoryId = new Map(
      allowedCommitRepositories.map((project) => [project.userRepository.id, project]),
    );
    const range = localDayQueryRange(date);
    const commits =
      repositoryIds.length === 0
        ? []
        : await db.commit.findMany({
            where: {
              userId: tenant.userId,
              userRepositoryId: { in: repositoryIds },
              isOnDefaultBranch: true,
              authorDate: { gte: range.start, lt: range.end },
            },
            select: {
              userRepositoryId: true,
              message: true,
              authorDate: true,
            },
            orderBy: { authorDate: "asc" },
          });
    const messagesByProject = new Map<string, string[]>();

    for (const commit of commits) {
      if (toLocalDateKey(commit.authorDate, context.timezone) !== date) {
        continue;
      }

      const project = projectByRepositoryId.get(commit.userRepositoryId);

      if (!project) {
        continue;
      }

      const messages = messagesByProject.get(project.id) ?? [];

      if (messages.length < 10) {
        messages.push(commit.message.slice(0, 500));
        messagesByProject.set(project.id, messages);
      }
    }

    const projects: SummaryProjectInput[] = rows
      .map((row) => {
        const project = projectById.get(row.projectId);

        if (!project) {
          return null;
        }

        return {
          projectId: project.id,
          projectTitle: project.displayTitle,
          commitCount: row.commitCount,
          commitMessages: messagesByProject.get(project.id) ?? [],
          additions: row.additions,
          deletions: row.deletions,
        };
      })
      .filter((project): project is SummaryProjectInput => project !== null)
      .sort(
        (left, right) =>
          right.commitCount - left.commitCount ||
          left.projectTitle.localeCompare(right.projectTitle),
      );
    const totalCommits = projects.reduce((sum, project) => sum + project.commitCount, 0);
    const input: SummaryInput = {
      date,
      timezone: context.timezone,
      totalCommits,
      projects,
    };
    const inputHash = createHash("sha256")
      .update(JSON.stringify({ version: 1, scope, ...input }))
      .digest("hex");

    return { input, inputHash };
  }

  async function generateScope(
    tenant: TenantContext,
    context: SummaryContext,
    date: string,
    scope: SummaryScope,
    now: Date,
    force: boolean,
  ): Promise<SummaryGenerationResult> {
    if (!context.settings.summariesEnabled) {
      return { scope, status: "SKIPPED", reason: "Daily summaries are disabled", summary: null };
    }

    if (scope === "PRIVATE" && !context.settings.allowPrivateMetadataForLlm) {
      return {
        scope,
        status: "SKIPPED",
        reason: "Private metadata opt-in is disabled",
        summary: null,
      };
    }

    if (date >= todayDateKey(context.timezone, now)) {
      return { scope, status: "SKIPPED", reason: "The local day has not ended", summary: null };
    }

    if (await hasIncompleteSync(tenant)) {
      return {
        scope,
        status: "SKIPPED",
        reason: "Repository sync is incomplete",
        summary: null,
      };
    }

    const { input, inputHash } = await buildInput(tenant, context, date, scope);
    const existing = await db.dailySummary.findUnique({
      where: {
        userId_date_timezone_scope_dataVersion: {
          userId: tenant.userId,
          date: dateKeyToUtcDate(date),
          timezone: context.timezone,
          scope,
          dataVersion: inputHash,
        },
      },
    });

    if (!force && existing?.generationStatus === "SUCCEEDED") {
      return { scope, status: "SUCCEEDED", reason: null, summary: toDailySummaryDto(existing) };
    }

    if (input.totalCommits === 0) {
      const skipped = await db.dailySummary.upsert({
        where: {
          userId_date_timezone_scope_dataVersion: {
            userId: tenant.userId,
            date: dateKeyToUtcDate(date),
            timezone: context.timezone,
            scope,
            dataVersion: inputHash,
          },
        },
        update: {
          generationStatus: "SKIPPED",
          headline: null,
          summary: null,
          projectHighlights: Prisma.JsonNull,
          inputHash,
          provider: null,
          modelName: null,
          errorMessage: "No qualifying activity",
          generatedAt: null,
        },
        create: {
          userId: tenant.userId,
          date: dateKeyToUtcDate(date),
          timezone: context.timezone,
          scope,
          dataVersion: inputHash,
          inputHash,
          generationStatus: "SKIPPED",
          errorMessage: "No qualifying activity",
        },
      });

      return {
        scope,
        status: "SKIPPED",
        reason: "No qualifying activity",
        summary: toDailySummaryDto(skipped),
      };
    }

    const provider = providerFactory({
      provider: context.settings.summaryProvider ?? env.SUMMARY_PROVIDER,
      model: context.settings.summaryModel ?? env.SUMMARY_MODEL,
      apiKey: env.SUMMARY_PROVIDER_API_KEY,
    });

    if (!provider) {
      return {
        scope,
        status: "SKIPPED",
        reason: "Summary provider is not configured",
        summary: null,
      };
    }

    const row = await db.dailySummary.upsert({
      where: {
        userId_date_timezone_scope_dataVersion: {
          userId: tenant.userId,
          date: dateKeyToUtcDate(date),
          timezone: context.timezone,
          scope,
          dataVersion: inputHash,
        },
      },
      update: {
        generationStatus: "RUNNING",
        inputHash,
        provider: provider.name,
        modelName: provider.model,
        errorMessage: null,
        generatedAt: null,
      },
      create: {
        userId: tenant.userId,
        date: dateKeyToUtcDate(date),
        timezone: context.timezone,
        scope,
        dataVersion: inputHash,
        inputHash,
        generationStatus: "RUNNING",
        provider: provider.name,
        modelName: provider.model,
      },
    });

    try {
      const output = summaryOutputSchema.parse(await provider.generate(input));
      const knownProjectIds = new Set(input.projects.map((project) => project.projectId));

      if (output.projectHighlights.some((highlight) => !knownProjectIds.has(highlight.projectId))) {
        throw new SummaryProviderError(
          "INVALID_OUTPUT",
          "Summary provider returned an unknown project",
        );
      }

      const completed = await db.dailySummary.update({
        where: { id: row.id },
        data: {
          generationStatus: "SUCCEEDED",
          headline: output.headline,
          summary: output.summary,
          projectHighlights: output.projectHighlights,
          errorMessage: null,
          generatedAt: now,
        },
      });

      return {
        scope,
        status: "SUCCEEDED",
        reason: null,
        summary: toDailySummaryDto(completed),
      };
    } catch (error) {
      const failed = await db.dailySummary.update({
        where: { id: row.id },
        data: {
          generationStatus: "FAILED",
          errorMessage: safeErrorMessage(error),
          generatedAt: null,
        },
      });

      return {
        scope,
        status: "FAILED",
        reason: safeErrorMessage(error),
        summary: toDailySummaryDto(failed),
      };
    }
  }

  return {
    async generateForDate(
      tenant: TenantContext,
      date: string,
      options: { now?: Date; scopes?: SummaryScope[]; force?: boolean } = {},
    ): Promise<SummaryGenerationResponse> {
      const context = await getContext(tenant);
      const now = options.now ?? new Date();
      const hasPrivateProjects = context.projects.some((project) => !isPublicProject(project));
      const scopes =
        options.scopes ??
        (context.settings.allowPrivateMetadataForLlm && hasPrivateProjects
          ? (["PUBLIC", "PRIVATE"] as SummaryScope[])
          : (["PUBLIC"] as SummaryScope[]));
      const summaries: SummaryGenerationResult[] = [];

      for (const scope of scopes) {
        summaries.push(
          await generateScope(tenant, context, date, scope, now, options.force ?? false),
        );
      }

      return { date, timezone: context.timezone, summaries };
    },

    async getDaySummary(
      tenant: TenantContext,
      date: string,
      scope?: SummaryScope,
    ): Promise<DailySummaryDto | null> {
      const context = await getContext(tenant);

      if (!context.settings.summariesEnabled) {
        return null;
      }

      const scopes = scope ? [scope] : (["PRIVATE", "PUBLIC"] as SummaryScope[]);

      for (const currentScope of scopes) {
        const summary = await db.dailySummary.findFirst({
          where: {
            userId: tenant.userId,
            date: dateKeyToUtcDate(date),
            timezone: context.timezone,
            scope: currentScope,
            generationStatus: "SUCCEEDED",
          },
          orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
        });

        if (summary) {
          return toDailySummaryDto(summary);
        }
      }

      return null;
    },

    async getPublicDaySummary(profileSlug: string, date: string): Promise<DailySummaryDto | null> {
      const user = await db.user.findFirst({
        where: {
          profileSlug,
          profileVisibility: "PUBLIC",
        },
        select: {
          id: true,
          timezone: true,
          settings: { select: { summariesEnabled: true } },
        },
      });

      if (!user || !user.settings?.summariesEnabled) {
        return null;
      }

      const summary = await db.dailySummary.findFirst({
        where: {
          userId: user.id,
          date: dateKeyToUtcDate(date),
          timezone: user.timezone,
          scope: "PUBLIC",
          generationStatus: "SUCCEEDED",
        },
        orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
      });

      return summary ? toDailySummaryDto(summary) : null;
    },

    async summaryStatus(tenant: TenantContext) {
      const [settings, groups, latest] = await Promise.all([
        db.userSettings.findUnique({
          where: { userId: tenant.userId },
          select: {
            summariesEnabled: true,
            allowPrivateMetadataForLlm: true,
            summaryProvider: true,
            summaryModel: true,
          },
        }),
        db.dailySummary.groupBy({
          by: ["generationStatus"],
          where: { userId: tenant.userId },
          _count: { _all: true },
        }),
        db.dailySummary.findFirst({
          where: { userId: tenant.userId, generationStatus: "SUCCEEDED" },
          orderBy: { generatedAt: "desc" },
          select: { generatedAt: true },
        }),
      ]);
      const counts = {
        succeeded: 0,
        failed: 0,
        running: 0,
        skipped: 0,
        pending: 0,
      };

      for (const group of groups) {
        const count = group._count._all;

        if (group.generationStatus === "SUCCEEDED") counts.succeeded = count;
        if (group.generationStatus === "FAILED") counts.failed = count;
        if (group.generationStatus === "RUNNING") counts.running = count;
        if (group.generationStatus === "SKIPPED") counts.skipped = count;
        if (group.generationStatus === "PENDING") counts.pending = count;
      }

      return {
        enabled: settings?.summariesEnabled ?? false,
        allowPrivateMetadataForLlm: settings?.allowPrivateMetadataForLlm ?? false,
        provider: settings?.summaryProvider ?? env.SUMMARY_PROVIDER ?? null,
        model: settings?.summaryModel ?? env.SUMMARY_MODEL ?? null,
        counts,
        latestGeneratedAt: latest?.generatedAt?.toISOString() ?? null,
      };
    },

    async listEnabledUsers() {
      return db.userSettings.findMany({
        where: { summariesEnabled: true },
        select: {
          userId: true,
          user: { select: { timezone: true } },
        },
      });
    },

    yesterdayFor(timezone: string, now: Date = new Date()): string {
      return addDays(todayDateKey(timezone, now), -1);
    },
  };
}

export type SummaryService = ReturnType<typeof createSummaryService>;
