import type {
  ActivityDetail,
  BackfillStatus,
  OwnerType,
  Prisma,
  ProjectStatus,
  RepositoryVisibility,
  SyncStatus,
  Visibility,
} from "@/generated/prisma/client";

export type UserRepositoryRecord = Prisma.UserRepositoryGetPayload<{
  include: { githubRepository: true; project: true };
}>;

export type UserRepositoryDto = {
  id: string;
  trackingEnabled: boolean;
  publicDisplayEnabled: boolean;
  publicActivityDetail: ActivityDetail;
  lastSyncedAt: string | null;
  syncStatus: SyncStatus;
  backfillStatus: BackfillStatus;
  firstDiscoveredAt: string;
  lastDiscoveredAt: string;
  repository: {
    id: string;
    githubRepositoryId: string;
    ownerLogin: string;
    ownerType: OwnerType;
    name: string;
    fullName: string;
    description: string | null;
    htmlUrl: string;
    visibility: RepositoryVisibility;
    defaultBranch: string;
    isArchived: boolean;
    isFork: boolean;
  };
  project: {
    id: string;
    slug: string;
    displayTitle: string;
    status: ProjectStatus;
    visibility: Visibility;
  } | null;
};

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toUserRepositoryDto(record: UserRepositoryRecord): UserRepositoryDto {
  const repository = record.githubRepository;

  return {
    id: record.id,
    trackingEnabled: record.trackingEnabled,
    publicDisplayEnabled: record.publicDisplayEnabled,
    publicActivityDetail: record.publicActivityDetail,
    lastSyncedAt: toIso(record.lastSyncedAt),
    syncStatus: record.syncStatus,
    backfillStatus: record.backfillStatus,
    firstDiscoveredAt: record.firstDiscoveredAt.toISOString(),
    lastDiscoveredAt: record.lastDiscoveredAt.toISOString(),
    repository: {
      id: repository.id,
      githubRepositoryId: repository.githubRepositoryId,
      ownerLogin: repository.ownerLogin,
      ownerType: repository.ownerType,
      name: repository.name,
      fullName: repository.fullName,
      description: repository.description,
      htmlUrl: repository.htmlUrl,
      visibility: repository.visibility,
      defaultBranch: repository.defaultBranch,
      isArchived: repository.isArchived,
      isFork: repository.isFork,
    },
    project: record.project
      ? {
          id: record.project.id,
          slug: record.project.slug,
          displayTitle: record.project.displayTitle,
          status: record.project.status,
          visibility: record.project.visibility,
        }
      : null,
  };
}
