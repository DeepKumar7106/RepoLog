import {
  type ActivityDetail,
  type OwnerType,
  type Prisma,
  type RepositoryVisibility,
} from "@/generated/prisma/client";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import type { UserRepositoryRecord } from "@/server/dto/user-repository-dto";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";

export type UserRepositoryUpdate = {
  trackingEnabled?: boolean;
  publicDisplayEnabled?: boolean;
  publicActivityDetail?: ActivityDetail;
};

export type UserRepositoryListOptions = {
  page?: number;
  perPage?: number;
  owner?: string;
  ownerType?: OwnerType;
  visibility?: RepositoryVisibility;
  archived?: boolean;
  tracking?: boolean;
  publicDisplay?: boolean;
  q?: string;
};

export type UserRepositoryListPage = {
  records: UserRepositoryRecord[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export function createUserRepositoryService(db: AppPrismaClient) {
  async function find(tenant: TenantContext, id: string) {
    return db.userRepository.findFirst({
      where: { id, userId: tenant.userId },
      include: {
        githubRepository: true,
        project: true,
      },
    });
  }

  async function get(tenant: TenantContext, id: string) {
    const record = await find(tenant, id);

    if (!record) {
      throw new TenantAccessDeniedError();
    }

    return record;
  }

  return {
    async list(tenant: TenantContext) {
      return db.userRepository.findMany({
        where: { userId: tenant.userId },
        include: {
          githubRepository: true,
          project: true,
        },
        orderBy: { createdAt: "asc" },
      });
    },

    async listPage(
      tenant: TenantContext,
      options: UserRepositoryListOptions = {},
    ): Promise<UserRepositoryListPage> {
      const requestedPage = Math.max(1, Math.floor(options.page ?? 1));
      const perPage = Math.min(Math.max(Math.floor(options.perPage ?? 50), 1), 100);

      const where: Prisma.UserRepositoryWhereInput = {
        userId: tenant.userId,
        ...(options.tracking === undefined ? {} : { trackingEnabled: options.tracking }),
        ...(options.publicDisplay === undefined
          ? {}
          : { publicDisplayEnabled: options.publicDisplay }),
        githubRepository: {
          ...(options.owner
            ? { ownerLogin: { contains: options.owner, mode: "insensitive" } }
            : {}),
          ...(options.ownerType ? { ownerType: options.ownerType } : {}),
          ...(options.visibility ? { visibility: options.visibility } : {}),
          ...(options.archived === undefined ? {} : { isArchived: options.archived }),
          ...(options.q
            ? {
                OR: [
                  { fullName: { contains: options.q, mode: "insensitive" } },
                  { name: { contains: options.q, mode: "insensitive" } },
                  { description: { contains: options.q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      };

      const total = await db.userRepository.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const page = Math.min(requestedPage, totalPages);

      const records = await db.userRepository.findMany({
        where,
        include: {
          githubRepository: true,
          project: true,
        },
        orderBy: { githubRepository: { fullName: "asc" } },
        skip: (page - 1) * perPage,
        take: perPage,
      });

      return {
        records,
        total,
        page,
        perPage,
        totalPages,
      };
    },

    async counts(tenant: TenantContext) {
      const [total, tracked, publicDisplay] = await db.$transaction([
        db.userRepository.count({ where: { userId: tenant.userId } }),
        db.userRepository.count({ where: { userId: tenant.userId, trackingEnabled: true } }),
        db.userRepository.count({ where: { userId: tenant.userId, publicDisplayEnabled: true } }),
      ]);

      return { total, tracked, publicDisplay };
    },

    async metrics(tenant: TenantContext) {
      const [commits, activeDays, projects, running, failed, backfilling] = await db.$transaction([
        db.commit.count({ where: { userId: tenant.userId } }),
        db.dailyProjectActivity.findMany({
          where: { userId: tenant.userId },
          distinct: ["date"],
          select: { date: true },
        }),
        db.project.count({ where: { userId: tenant.userId } }),
        db.userRepository.count({
          where: { userId: tenant.userId, trackingEnabled: true, syncStatus: "RUNNING" },
        }),
        db.userRepository.count({
          where: { userId: tenant.userId, trackingEnabled: true, syncStatus: "FAILED" },
        }),
        db.userRepository.count({
          where: {
            userId: tenant.userId,
            trackingEnabled: true,
            backfillStatus: { in: ["NOT_STARTED", "QUEUED", "IN_PROGRESS", "PARTIAL"] },
          },
        }),
      ]);

      return {
        commits,
        activeDays: activeDays.length,
        projects,
        running,
        failed,
        backfilling,
      };
    },

    find,
    get,

    async updateMany(tenant: TenantContext, data: UserRepositoryUpdate, ids?: string[]) {
      const result = await db.userRepository.updateMany({
        where: {
          userId: tenant.userId,
          ...(ids ? { id: { in: ids } } : {}),
        },
        data,
      });

      if (
        result.count > 0 &&
        (data.publicDisplayEnabled !== undefined ||
          data.publicActivityDetail !== undefined ||
          data.trackingEnabled !== undefined)
      ) {
        await db.dailySummary.deleteMany({ where: { userId: tenant.userId } });
      }

      return result.count;
    },

    async update(tenant: TenantContext, id: string, data: UserRepositoryUpdate) {
      const result = await db.userRepository.updateMany({
        where: { id, userId: tenant.userId },
        data,
      });

      if (result.count === 0) {
        throw new TenantAccessDeniedError();
      }

      if (
        data.publicDisplayEnabled !== undefined ||
        data.publicActivityDetail !== undefined ||
        data.trackingEnabled !== undefined
      ) {
        await db.dailySummary.deleteMany({ where: { userId: tenant.userId } });
      }

      return get(tenant, id);
    },
  };
}

export type UserRepositoryService = ReturnType<typeof createUserRepositoryService>;
