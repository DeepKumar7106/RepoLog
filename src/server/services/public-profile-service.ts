import type { ActivityDetail, ProjectStatus } from "@/generated/prisma/enums";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import {
  addDays,
  dateKeyToUtcDate,
  localDayQueryRange,
  todayDateKey,
  toLocalDateKey,
} from "@/lib/time/dates";

export type PublicProjectCardDto = {
  id: string;
  slug: string;
  displayTitle: string;
  shortDescription: string | null;
  status: ProjectStatus;
  demoUrl: string | null;
  latestCommitAt: string | null;
};

export type PublicProfileDto = {
  profileSlug: string;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileBio: string | null;
  searchIndexingEnabled: boolean;
  projects: PublicProjectCardDto[];
};

export type PublicProjectDto = PublicProjectCardDto & {
  readmeMarkdown: string | null;
  firstCommitAt: string | null;
  latestCommitAt: string | null;
  activityDetail: ActivityDetail;
  searchIndexingEnabled: boolean;
  owner: {
    profileSlug: string;
    githubLogin: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  repository: {
    ownerLogin: string;
    name: string;
    fullName: string;
    htmlUrl: string;
  } | null;
};

export type PublicActivityProjectDto = {
  slug: string;
  displayTitle: string;
  commitCount: number;
};

export type PublicActivityDayDto = {
  date: string;
  commitCount: number;
  projectCount: number;
  firstCommitAt: string | null;
  lastCommitAt: string | null;
};

export type PublicActivityDto = {
  profileSlug: string;
  from: string;
  to: string;
  timezone: string;
  projects: PublicActivityProjectDto[];
  days: PublicActivityDayDto[];
  totals: {
    commits: number;
    activeDays: number;
    projectCount: number;
    firstCommitAt: string | null;
    latestCommitAt: string | null;
  };
};

export type PublicDayProjectDto = {
  slug: string;
  displayTitle: string;
  commitCount: number;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
};

export type PublicCommitDto = {
  sha: string;
  message: string;
  htmlUrl: string;
  authorDate: string;
  authorName: string;
  projectSlug: string;
  projectTitle: string;
};

export type PublicDayDto = {
  date: string;
  timezone: string;
  totalCommits: number;
  projects: PublicDayProjectDto[];
  commits: PublicCommitDto[];
};

export type PublicActivityOptions = {
  from?: string;
  to?: string;
  projectSlug?: string;
};

const DEFAULT_ACTIVITY_DAYS = 90;

function activityRange(options: PublicActivityOptions, timezone: string) {
  const to = options.to ?? todayDateKey(timezone);
  const from = options.from ?? addDays(to, -(DEFAULT_ACTIVITY_DAYS - 1));

  return from <= to ? { from, to } : { from: to, to: from };
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function createPublicProfileService(db: AppPrismaClient) {
  return {
    async findProfileBySlug(slug: string): Promise<PublicProfileDto | null> {
      const record = await db.user.findFirst({
        where: {
          profileSlug: slug,
          profileVisibility: "PUBLIC",
        },
        select: {
          profileSlug: true,
          githubLogin: true,
          displayName: true,
          avatarUrl: true,
          profileBio: true,
          searchIndexingEnabled: true,
          projects: {
            where: {
              visibility: "PUBLIC",
              userRepository: {
                publicDisplayEnabled: true,
              },
            },
            select: {
              id: true,
              slug: true,
              displayTitle: true,
              shortDescription: true,
              status: true,
              demoUrl: true,
              latestCommitAt: true,
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      });

      if (!record) {
        return null;
      }

      return {
        ...record,
        projects: record.projects.map((project) => ({
          ...project,
          latestCommitAt: toIso(project.latestCommitAt),
        })),
      };
    },

    async listPublicEntries() {
      const users = await db.user.findMany({
        where: {
          profileVisibility: "PUBLIC",
          searchIndexingEnabled: true,
        },
        select: {
          profileSlug: true,
          updatedAt: true,
          projects: {
            where: {
              visibility: "PUBLIC",
              userRepository: { publicDisplayEnabled: true },
            },
            select: {
              slug: true,
              updatedAt: true,
            },
          },
        },
      });

      return users.flatMap((user) => [
        {
          profileSlug: user.profileSlug,
          projectSlug: null as string | null,
          updatedAt: user.updatedAt,
        },
        ...user.projects.map((project) => ({
          profileSlug: user.profileSlug,
          projectSlug: project.slug,
          updatedAt: project.updatedAt,
        })),
      ]);
    },

    async findFeaturedProfile() {
      return db.user.findFirst({
        where: {
          profileVisibility: "PUBLIC",
          projects: {
            some: {
              visibility: "PUBLIC",
              userRepository: { publicDisplayEnabled: true },
            },
          },
        },
        select: {
          profileSlug: true,
          githubLogin: true,
          displayName: true,
        },
        orderBy: { updatedAt: "desc" },
      });
    },

    async findProjectBySlugs(
      profileSlug: string,
      projectSlug: string,
    ): Promise<PublicProjectDto | null> {
      const record = await db.project.findFirst({
        where: {
          slug: projectSlug,
          visibility: "PUBLIC",
          user: {
            profileSlug,
            profileVisibility: "PUBLIC",
          },
          userRepository: {
            publicDisplayEnabled: true,
          },
        },
        select: {
          id: true,
          slug: true,
          displayTitle: true,
          shortDescription: true,
          status: true,
          demoUrl: true,
          publicReadmeMarkdown: true,
          firstCommitAt: true,
          latestCommitAt: true,
          user: {
            select: {
              profileSlug: true,
              githubLogin: true,
              displayName: true,
              avatarUrl: true,
              searchIndexingEnabled: true,
            },
          },
          userRepository: {
            select: {
              publicActivityDetail: true,
              githubRepository: {
                select: {
                  ownerLogin: true,
                  name: true,
                  fullName: true,
                  htmlUrl: true,
                  visibility: true,
                },
              },
            },
          },
        },
      });

      if (!record) {
        return null;
      }

      const repository = record.userRepository.githubRepository;
      const canExposeRepository = repository.visibility === "PUBLIC";

      return {
        id: record.id,
        slug: record.slug,
        displayTitle: record.displayTitle,
        shortDescription: record.shortDescription,
        status: record.status,
        demoUrl: record.demoUrl,
        readmeMarkdown: record.publicReadmeMarkdown,
        firstCommitAt: toIso(record.firstCommitAt),
        latestCommitAt: toIso(record.latestCommitAt),
        activityDetail: record.userRepository.publicActivityDetail,
        searchIndexingEnabled: record.user.searchIndexingEnabled,
        owner: {
          profileSlug: record.user.profileSlug,
          githubLogin: record.user.githubLogin,
          displayName: record.user.displayName,
          avatarUrl: record.user.avatarUrl,
        },
        repository: canExposeRepository
          ? {
              ownerLogin: repository.ownerLogin,
              name: repository.name,
              fullName: repository.fullName,
              htmlUrl: repository.htmlUrl,
            }
          : null,
      };
    },

    async getActivity(
      profileSlug: string,
      options: PublicActivityOptions = {},
    ): Promise<PublicActivityDto | null> {
      const profile = await db.user.findFirst({
        where: {
          profileSlug,
          profileVisibility: "PUBLIC",
        },
        select: {
          id: true,
          profileSlug: true,
          timezone: true,
          projects: {
            where: {
              visibility: "PUBLIC",
              userRepository: { publicDisplayEnabled: true },
            },
            select: {
              id: true,
              slug: true,
              displayTitle: true,
              userRepository: {
                select: { publicActivityDetail: true },
              },
            },
            orderBy: { displayTitle: "asc" },
          },
        },
      });

      if (!profile) {
        return null;
      }

      const matchingProject = options.projectSlug
        ? profile.projects.find((project) => project.slug === options.projectSlug)
        : null;

      if (options.projectSlug && !matchingProject) {
        return null;
      }

      const { from, to } = activityRange(options, profile.timezone);
      const activityProjects = profile.projects.filter(
        (project) =>
          project.userRepository.publicActivityDetail !== "HIDDEN" &&
          (!options.projectSlug || project.slug === options.projectSlug),
      );
      const projectIds = activityProjects.map((project) => project.id);

      const rows =
        projectIds.length === 0
          ? []
          : await db.dailyProjectActivity.findMany({
              where: {
                userId: profile.id,
                timezone: profile.timezone,
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
        profileSlug: profile.profileSlug,
        from,
        to,
        timezone: profile.timezone,
        projects: activityProjects.map((project) => ({
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

    async getDay(
      profileSlug: string,
      date: string,
      options: PublicActivityOptions = {},
    ): Promise<PublicDayDto | null> {
      const profile = await db.user.findFirst({
        where: {
          profileSlug,
          profileVisibility: "PUBLIC",
        },
        select: {
          id: true,
          timezone: true,
          projects: {
            where: {
              visibility: "PUBLIC",
              userRepository: { publicDisplayEnabled: true },
            },
            select: {
              id: true,
              slug: true,
              displayTitle: true,
              userRepository: {
                select: {
                  id: true,
                  publicActivityDetail: true,
                  githubRepository: {
                    select: { visibility: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!profile) {
        return null;
      }

      if (
        options.projectSlug &&
        !profile.projects.some((project) => project.slug === options.projectSlug)
      ) {
        return null;
      }

      const activityProjects = profile.projects.filter(
        (project) =>
          project.userRepository.publicActivityDetail !== "HIDDEN" &&
          (!options.projectSlug || project.slug === options.projectSlug),
      );
      const projectIds = activityProjects.map((project) => project.id);
      const rows =
        projectIds.length === 0
          ? []
          : await db.dailyProjectActivity.findMany({
              where: {
                userId: profile.id,
                timezone: profile.timezone,
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
      const projectById = new Map(activityProjects.map((project) => [project.id, project]));
      const projects = rows.map((row) => {
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

      const allowedCommitProjects = activityProjects.filter(
        (project) =>
          project.userRepository.publicActivityDetail === "COMMIT_DETAILS" &&
          project.userRepository.githubRepository.visibility === "PUBLIC",
      );
      const repositoryIds = allowedCommitProjects.map((project) => project.userRepository.id);
      const range = localDayQueryRange(date);
      const commits =
        repositoryIds.length === 0
          ? []
          : await db.commit.findMany({
              where: {
                userId: profile.id,
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
                userRepositoryId: true,
              },
              orderBy: { authorDate: "asc" },
            });
      const projectByRepositoryId = new Map(
        allowedCommitProjects.map((project) => [project.userRepository.id, project]),
      );
      const publicCommits = commits
        .filter((commit) => toLocalDateKey(commit.authorDate, profile.timezone) === date)
        .map((commit) => {
          const project = projectByRepositoryId.get(commit.userRepositoryId);

          return {
            sha: commit.sha,
            message: commit.message,
            htmlUrl: commit.htmlUrl,
            authorDate: commit.authorDate.toISOString(),
            authorName: commit.authorName,
            projectSlug: project?.slug ?? "",
            projectTitle: project?.displayTitle ?? "",
          };
        });

      return {
        date,
        timezone: profile.timezone,
        totalCommits: projects.reduce((sum, project) => sum + project.commitCount, 0),
        projects: projects.filter((project) => project.commitCount > 0),
        commits: publicCommits,
      };
    },
  };
}

export type PublicProfileService = ReturnType<typeof createPublicProfileService>;
