import type {
  OwnerType,
  Prisma,
  ProjectStatus,
  RepositoryVisibility,
  Visibility,
} from "@/generated/prisma/client";

export type ProjectRecord = Prisma.ProjectGetPayload<{
  include: { userRepository: { include: { githubRepository: true } } };
}>;

export type ProjectDto = {
  id: string;
  slug: string;
  displayTitle: string;
  shortDescription: string | null;
  status: ProjectStatus;
  visibility: Visibility;
  demoUrl: string | null;
  publicReadmeUpdatedAt: string | null;
  firstCommitAt: string | null;
  latestCommitAt: string | null;
  repository: {
    id: string;
    githubRepositoryId: string;
    ownerLogin: string;
    ownerType: OwnerType;
    name: string;
    fullName: string;
    htmlUrl: string;
    visibility: RepositoryVisibility;
    defaultBranch: string;
    isArchived: boolean;
    isFork: boolean;
  };
};

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toProjectDto(record: ProjectRecord): ProjectDto {
  const repository = record.userRepository.githubRepository;

  return {
    id: record.id,
    slug: record.slug,
    displayTitle: record.displayTitle,
    shortDescription: record.shortDescription,
    status: record.status,
    visibility: record.visibility,
    demoUrl: record.demoUrl,
    publicReadmeUpdatedAt: toIso(record.publicReadmeUpdatedAt),
    firstCommitAt: toIso(record.firstCommitAt),
    latestCommitAt: toIso(record.latestCommitAt),
    repository: {
      id: repository.id,
      githubRepositoryId: repository.githubRepositoryId,
      ownerLogin: repository.ownerLogin,
      ownerType: repository.ownerType,
      name: repository.name,
      fullName: repository.fullName,
      htmlUrl: repository.htmlUrl,
      visibility: repository.visibility,
      defaultBranch: repository.defaultBranch,
      isArchived: repository.isArchived,
      isFork: repository.isFork,
    },
  };
}
