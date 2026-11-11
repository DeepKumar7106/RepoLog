import { Prisma } from "@/generated/prisma/client";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";

export class AuthorEmailExistsError extends Error {
  readonly code = "AUTHOR_EMAIL_EXISTS";

  constructor() {
    super("That author email is already listed");
    this.name = "AuthorEmailExistsError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createAuthorEmailService(db: AppPrismaClient) {
  async function get(tenant: TenantContext, id: string) {
    const record = await db.authorEmail.findFirst({
      where: { id, userId: tenant.userId },
    });

    if (!record) {
      throw new TenantAccessDeniedError();
    }

    return record;
  }

  return {
    async list(tenant: TenantContext) {
      return db.authorEmail.findMany({
        where: { userId: tenant.userId },
        orderBy: [{ verifiedByUser: "desc" }, { email: "asc" }],
      });
    },

    async add(tenant: TenantContext, email: string, verifiedByUser = true) {
      try {
        return await db.authorEmail.create({
          data: {
            userId: tenant.userId,
            email: normalizeEmail(email),
            verifiedByUser,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new AuthorEmailExistsError();
        }

        throw error;
      }
    },

    async update(tenant: TenantContext, id: string, verifiedByUser: boolean) {
      const result = await db.authorEmail.updateMany({
        where: { id, userId: tenant.userId },
        data: { verifiedByUser },
      });

      if (result.count === 0) {
        throw new TenantAccessDeniedError();
      }

      return get(tenant, id);
    },

    async remove(tenant: TenantContext, id: string) {
      const result = await db.authorEmail.deleteMany({
        where: { id, userId: tenant.userId },
      });

      if (result.count === 0) {
        throw new TenantAccessDeniedError();
      }
    },
  };
}

export type AuthorEmailService = ReturnType<typeof createAuthorEmailService>;
