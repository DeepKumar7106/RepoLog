import type { SyncTrigger } from "@/generated/prisma/enums";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";

export type StartSyncRunInput = {
  userRepositoryId?: string;
  trigger: SyncTrigger;
};

export function createSyncRunService(db: AppPrismaClient) {
  return {
    async list(tenant: TenantContext, limit = 50) {
      const take = Math.min(Math.max(limit, 1), 100);

      return db.syncRun.findMany({
        where: { userId: tenant.userId },
        include: {
          userRepository: {
            include: {
              githubRepository: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      });
    },

    async lastDiscovery(tenant: TenantContext) {
      return db.syncRun.findFirst({
        where: {
          userId: tenant.userId,
          userRepositoryId: null,
        },
        orderBy: { createdAt: "desc" },
      });
    },

    async lastRepositorySync(tenant: TenantContext) {
      return db.syncRun.findFirst({
        where: {
          userId: tenant.userId,
          userRepositoryId: { not: null },
        },
        include: {
          userRepository: {
            include: {
              githubRepository: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    },

    async start(tenant: TenantContext, input: StartSyncRunInput) {
      if (input.userRepositoryId) {
        const repository = await db.userRepository.findFirst({
          where: { id: input.userRepositoryId, userId: tenant.userId },
          select: { id: true },
        });

        if (!repository) {
          throw new TenantAccessDeniedError();
        }
      }

      return db.syncRun.create({
        data: {
          userId: tenant.userId,
          userRepositoryId: input.userRepositoryId ?? null,
          trigger: input.trigger,
          status: "PENDING",
        },
      });
    },
  };
}

export type SyncRunService = ReturnType<typeof createSyncRunService>;
