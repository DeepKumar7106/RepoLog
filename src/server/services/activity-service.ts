import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import type { TenantContext } from "@/lib/tenancy/tenant-context";
import {
  addDays,
  dateKeyToUtcDate,
  localDayQueryRange,
  todayDateKey,
  toLocalDateKey,
} from "@/lib/time/dates";

export type PrivateActivityProjectDto = {
  slug: string;
  displayTitle: string;
  commitCount: number;
};

export type PrivateActivityDayDto = {
  date: string;
  commitCount: number;
  projectCount: number;
  firstCommitAt: string | null;
  lastCommitAt: string | null;
};

export type PrivateActivitySummaryDto = {
  from: string;
  to: string;
  timezone: string;
  projects: PrivateActivityProjectDto[];
  days: PrivateActivityDayDto[];
  totals: {
    commits: number;
    activeDays: number;
    projectCount: number;
    firstCommitAt: string | null;
    latestCommitAt: string | null;
  };
};

export type PrivateDayProjectDto = {
  slug: string;
  displayTitle: string;
  commitCount: number;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
};

export type PrivateDayCommitDto = {
  sha: string;
  message: string;
  htmlUrl: string;
  authorDate: string;
  authorName: string;
  projectSlug: string;
  projectTitle: string;
};

export type PrivateDayDto = {
  date: string;
  timezone: string;
  totalCommits: number;
  projects: PrivateDayProjectDto[];
  commits: PrivateDayCommitDto[];
};

export type ActivityOptions = {
  from?: string;
  to?: string;
  projectSlug?: string;
};

const DEFAULT_ACTIVITY_DAYS = 90;

function activityRange(options: ActivityOptions, timezone: string) {
  const to = options.to ?? todayDateKey(timezone);
  const from = options.from ?? addDays(to, -(DEFAULT_ACTIVITY_DAYS - 1));

  return from <= to ? { from, to } : { from: to, to: from };
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function createActivityService(db: AppPrismaClient) {
  async function getContext(tenant: TenantContext) {
    return db.user.findUnique({
      where: { id: tenant.userId },
      select: {
        timezone: true,
        projects: {
          select: {
            id: true,
            slug: true,
            displayTitle: true,
            userRepository: { select: { id: true } },
          },
          orderBy: { displayTitle: "asc" },
        },
      },
    });
  }

  return {
    async summary(
      tenant: TenantContext,
      options: ActivityOptions = {},
    ): Promise<PrivateActivitySummaryDto | null> {
      const context = await getContext(tenant);

      if (!context) {
        return null;
      }

      const matchingProject = options.projectSlug
        ? context.projects.find((project) => project.slug === options.projectSlug)
        : null;

      if (options.projectSlug && !matchingProject) {
        return null;
      }

      const { from, to } = activityRange(options, context.timezone);
      const projects = context.projects.filter(
        (project) => !options.projectSlug || project.slug === options.projectSlug,
      );
      const projectIds = projects.map((project) => project.id);
      const rows =
        projectIds.length === 0
          ? []
          : await db.dailyProjectActivity.findMany({
              where: {
                userId: tenant.userId,
                timezone: context.timezone,
                date: {
                  gte: dateKeyToUtcDate(from),
                  lte: dateKeyToUtcDate(to),
                },
                projectId: { in: projectIds },
              },
              select: {
                projectId: true,
                date: true,
                commitCount: true,
                firstCommitAt: true,
                lastCommitAt: true,
              },
              orderBy: { date: "asc" },
            });

      const projectCounts = new Map<string, number>();
      const days = new Map<
        string,
        {
          commitCount: number;
          projectIds: Set<string>;
          firstCommitAt: Date | null;
          lastCommitAt: Date | null;
        }
      >();

      for (const row of rows) {
        projectCounts.set(row.projectId, (projectCounts.get(row.projectId) ?? 0) + row.commitCount);

        const date = row.date.toISOString().slice(0, 10);
        const day = days.get(date) ?? {
          commitCount: 0,
          projectIds: new Set<string>(),
          firstCommitAt: null,
          lastCommitAt: null,
        };

        day.commitCount += row.commitCount;
        day.projectIds.add(row.projectId);
        day.firstCommitAt =
          row.firstCommitAt && (!day.firstCommitAt || row.firstCommitAt < day.firstCommitAt)
            ? row.firstCommitAt
            : day.firstCommitAt;
        day.lastCommitAt =
          row.lastCommitAt && (!day.lastCommitAt || row.lastCommitAt > day.lastCommitAt)
            ? row.lastCommitAt
            : day.lastCommitAt;
        days.set(date, day);
      }

      const dayList = [...days.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, day]) => ({
          date,
          commitCount: day.commitCount,
          projectCount: day.projectIds.size,
          firstCommitAt: toIso(day.firstCommitAt),
          lastCommitAt: toIso(day.lastCommitAt),
        }));
      const activeProjectIds = new Set(
        dayList.flatMap((day) => [...(days.get(day.date)?.projectIds ?? [])]),
      );

      return {
        from,
        to,
        timezone: context.timezone,
        projects: projects.map((project) => ({
          slug: project.slug,
          displayTitle: project.displayTitle,
          commitCount: projectCounts.get(project.id) ?? 0,
        })),
        days: dayList,
        totals: {
          commits: dayList.reduce((sum, day) => sum + day.commitCount, 0),
          activeDays: dayList.length,
          projectCount: activeProjectIds.size,
          firstCommitAt: dayList.find((day) => day.firstCommitAt)?.firstCommitAt ?? null,
          latestCommitAt:
            [...dayList].reverse().find((day) => day.lastCommitAt)?.lastCommitAt ?? null,
        },
      };
    },

    async day(
      tenant: TenantContext,
      date: string,
      options: ActivityOptions = {},
    ): Promise<PrivateDayDto | null> {
      const context = await getContext(tenant);

      if (!context) {
        return null;
      }

      if (
        options.projectSlug &&
        !context.projects.some((project) => project.slug === options.projectSlug)
      ) {
        return null;
      }

      const projects = context.projects.filter(
        (project) => !options.projectSlug || project.slug === options.projectSlug,
      );
      const projectIds = projects.map((project) => project.id);
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
                changedFiles: true,
              },
            });
      const projectById = new Map(projects.map((project) => [project.id, project]));
      const dayProjects = rows.map((row) => {
        const project = projectById.get(row.projectId);

        return {
          slug: project?.slug ?? "",
          displayTitle: project?.displayTitle ?? "",
          commitCount: row.commitCount,
          additions: row.additions,
          deletions: row.deletions,
          changedFiles: row.changedFiles,
        };
      });
      const repositoryIds = projects.map((project) => project.userRepository.id);
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
                sha: true,
                message: true,
                htmlUrl: true,
                authorDate: true,
                authorName: true,
                userRepository: {
                  select: {
                    project: {
                      select: { slug: true, displayTitle: true },
                    },
                  },
                },
              },
              orderBy: { authorDate: "asc" },
            });
      const dayCommits = commits
        .filter((commit) => toLocalDateKey(commit.authorDate, context.timezone) === date)
        .map((commit) => ({
          sha: commit.sha,
          message: commit.message,
          htmlUrl: commit.htmlUrl,
          authorDate: commit.authorDate.toISOString(),
          authorName: commit.authorName,
          projectSlug: commit.userRepository.project?.slug ?? "",
          projectTitle: commit.userRepository.project?.displayTitle ?? "",
        }));

      return {
        date,
        timezone: context.timezone,
        totalCommits: dayProjects.reduce((sum, project) => sum + project.commitCount, 0),
        projects: dayProjects.filter((project) => project.commitCount > 0),
        commits: dayCommits,
      };
    },
  };
}

export type ActivityService = ReturnType<typeof createActivityService>;
