import { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus, Visibility } from "@/generated/prisma/enums";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";
import { normalizeSlug } from "@/lib/urls/slugs";

const MAX_SLUG_LENGTH = 39;

export class ProjectNotTrackedError extends Error {
  readonly code = "PROJECT_NOT_TRACKED";

  constructor() {
    super("Enable tracking for this repository before creating a project");
    this.name = "ProjectNotTrackedError";
  }
}

export class ProjectSlugConflictError extends Error {
  readonly code = "PROJECT_SLUG_CONFLICT";

  constructor() {
    super("That project slug is already in use");
    this.name = "ProjectSlugConflictError";
  }
}

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

function slugCandidate(base: string, attempt: number): string {
  const suffix = attempt === 1 ? "" : `-${attempt}`;
  const root = normalizeSlug(base) || "project";

  return `${root.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/g, "")}${suffix}`;
}

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

  async function uniqueSlug(tenant: TenantContext, base: string, excludeId?: string) {
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const candidate = slugCandidate(base, attempt);
      const existing = await db.project.findFirst({
        where: {
          userId: tenant.userId,
          slug: candidate,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ProjectSlugConflictError();
  }

  async function ensureForUserRepository(tenant: TenantContext, userRepositoryId: string) {
    const connection = await db.userRepository.findFirst({
      where: { id: userRepositoryId, userId: tenant.userId },
      include: {
        project: { select: { id: true } },
        githubRepository: true,
      },
    });

    if (!connection) {
      throw new TenantAccessDeniedError();
    }

    if (connection.project) {
      return get(tenant, connection.project.id);
    }

    if (!connection.trackingEnabled) {
      throw new ProjectNotTrackedError();
    }

    const repository = connection.githubRepository;
    const slug = await uniqueSlug(tenant, repository.name);

    try {
      const created = await db.project.create({
        data: {
          userId: tenant.userId,
          userRepositoryId: connection.id,
          slug,
          displayTitle: repository.name,
          shortDescription: repository.description?.slice(0, 280) ?? null,
          status: "ONGOING",
          visibility: "PRIVATE",
        },
      });

      return get(tenant, created.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await db.project.findUnique({
          where: { userRepositoryId: connection.id },
          select: { id: true },
        });

        if (existing) {
          return get(tenant, existing.id);
        }

        throw new ProjectSlugConflictError();
      }

      throw error;
    }
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

    async ensureForUserRepository(tenant: TenantContext, userRepositoryId: string) {
      return ensureForUserRepository(tenant, userRepositoryId);
    },

    async ensureForTrackedRepositories(tenant: TenantContext) {
      const connections = await db.userRepository.findMany({
        where: { userId: tenant.userId, trackingEnabled: true },
        include: {
          project: { select: { id: true } },
          githubRepository: true,
        },
        orderBy: { githubRepository: { fullName: "asc" } },
      });
      const missing = connections.filter((connection) => !connection.project);
      const projects = [];

      for (const connection of missing) {
        projects.push(await ensureForUserRepository(tenant, connection.id));
      }

      return projects;
    },

    async update(tenant: TenantContext, id: string, data: ProjectUpdate) {
      const existing = await find(tenant, id);

      if (!existing) {
        throw new TenantAccessDeniedError();
      }

      if (data.slug !== undefined) {
        const conflict = await db.project.findFirst({
          where: {
            userId: tenant.userId,
            slug: data.slug,
            id: { not: existing.id },
          },
          select: { id: true },
        });

        if (conflict) {
          throw new ProjectSlugConflictError();
        }
      }
      const readmeChanged =
        data.publicReadmeMarkdown !== undefined &&
        data.publicReadmeMarkdown !== existing.publicReadmeMarkdown;
      const updateData: Prisma.ProjectUpdateManyMutationInput = {
        ...data,
        ...(readmeChanged ? { publicReadmeUpdatedAt: new Date() } : {}),
      };
      try {
        const result = await db.project.updateMany({
          where: { id, userId: tenant.userId },
          data: updateData,
        });

        if (result.count === 0) {
          throw new TenantAccessDeniedError();
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ProjectSlugConflictError();
        }

        throw error;
      }

      if (data.displayTitle !== undefined || data.visibility !== undefined) {
        await db.dailySummary.deleteMany({ where: { userId: tenant.userId } });
      }

      return get(tenant, id);
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
