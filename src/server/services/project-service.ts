import type { ProjectStatus, Visibility } from "@/generated/prisma/enums";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";

export type ProjectUpdate = {
  displayTitle?: string;
  shortDescription?: string | null;
  status?: ProjectStatus;
  visibility?: Visibility;
  demoUrl?: string | null;
  slug?: string;
  publicReadmeMarkdown?: string | null;
};

const projectInclude = {
  userRepository: {
    include: {
      githubRepository: true,
    },
  },
} as const;

export function createProjectService(db: AppPrismaClient) {
  async function find(tenant: TenantContext, id: string) {
    return db.project.findFirst({
      where: { id, userId: tenant.userId },
      include: projectInclude,
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
      return db.project.findMany({
        where: { userId: tenant.userId },
        include: projectInclude,
        orderBy: { updatedAt: "desc" },
      });
    },

    find,
    get,

    async update(tenant: TenantContext, id: string, data: ProjectUpdate) {
      const result = await db.project.updateMany({
        where: { id, userId: tenant.userId },
        data,
      });

      if (result.count === 0) {
        throw new TenantAccessDeniedError();
      }

      return get(tenant, id);
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
