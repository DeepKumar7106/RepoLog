import type { Prisma, SyncRunStatus, SyncTrigger } from "@/generated/prisma/client";

export type SyncRunRecord = Prisma.SyncRunGetPayload<{
  include: { userRepository: { include: { githubRepository: true } } };
}>;

export type SyncRunDto = {
  id: string;
  trigger: SyncTrigger;
  status: SyncRunStatus;
  startedAt: string;
  finishedAt: string | null;
  pagesProcessed: number;
  commitsProcessed: number;
  commitsInserted: number;
  errorCode: string | null;
  errorMessage: string | null;
  repository: {
    id: string;
    fullName: string;
  } | null;
};

export function toSyncRunDto(record: SyncRunRecord): SyncRunDto {
  return {
    id: record.id,
    trigger: record.trigger,
    status: record.status,
    startedAt: record.startedAt.toISOString(),
    finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
    pagesProcessed: record.pagesProcessed,
    commitsProcessed: record.commitsProcessed,
    commitsInserted: record.commitsInserted,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    repository: record.userRepository
      ? {
          id: record.userRepository.id,
          fullName: record.userRepository.githubRepository.fullName,
        }
      : null,
  };
}
