import type { ActivityDetail, ProjectStatus } from "@/generated/prisma/enums";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";

export type PublicProjectCardDto = {
  slug: string;
  displayTitle: string;
  shortDescription: string | null;
  status: ProjectStatus;
  demoUrl: string | null;
};

export type PublicProjectDto = PublicProjectCardDto & {
  readmeMarkdown: string | null;
  firstCommitAt: string | null;
  latestCommitAt: string | null;
  activityDetail: ActivityDetail;
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

export type PublicProfileDto = {
  profileSlug: string;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileBio: string | null;
  projects: PublicProjectCardDto[];
};

export function createPublicProfileService(db: AppPrismaClient) {
  return {
    async findProfileBySlug(slug: string): Promise<PublicProfileDto | null> {
      return db.user.findFirst({
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
          projects: {
            where: {
              visibility: "PUBLIC",
              userRepository: {
                publicDisplayEnabled: true,
              },
            },
            select: {
              slug: true,
              displayTitle: true,
              shortDescription: true,
              status: true,
              demoUrl: true,
            },
            orderBy: { updatedAt: "desc" },
          },
        },
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
        slug: record.slug,
        displayTitle: record.displayTitle,
        shortDescription: record.shortDescription,
        status: record.status,
        demoUrl: record.demoUrl,
        readmeMarkdown: record.publicReadmeMarkdown,
        firstCommitAt: record.firstCommitAt?.toISOString() ?? null,
        latestCommitAt: record.latestCommitAt?.toISOString() ?? null,
        activityDetail: record.userRepository.publicActivityDetail,
        owner: record.user,
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
  };
}

export type PublicProfileService = ReturnType<typeof createPublicProfileService>;
