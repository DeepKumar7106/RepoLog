import { Prisma } from "@/generated/prisma/client";
import type { Visibility } from "@/generated/prisma/enums";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";

export class ProfileSlugConflictError extends Error {
  readonly code = "PROFILE_SLUG_CONFLICT";

  constructor() {
    super("That profile slug is already in use");
    this.name = "ProfileSlugConflictError";
  }
}

export type UserProfileUpdate = {
  displayName?: string | null;
  profileBio?: string | null;
  profileSlug?: string;
  profileVisibility?: Visibility;
  searchIndexingEnabled?: boolean;
  timezone?: string;
};

export type OnboardingInput = {
  displayName?: string | null;
  profileBio?: string | null;
  profileVisibility: Visibility;
  searchIndexingEnabled?: boolean;
  timezone?: string;
};

export function createUserProfileService(db: AppPrismaClient) {
  async function get(tenant: TenantContext) {
    const user = await db.user.findUnique({
      where: { id: tenant.userId },
    });

    if (!user) {
      throw new TenantAccessDeniedError();
    }

    return user;
  }

  async function assertSlugAvailable(tenant: TenantContext, slug: string) {
    const existing = await db.user.findFirst({
      where: {
        profileSlug: slug,
        id: { not: tenant.userId },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ProfileSlugConflictError();
    }
  }

  return {
    get,

    async update(tenant: TenantContext, data: UserProfileUpdate) {
      if (data.profileSlug !== undefined) {
        await assertSlugAvailable(tenant, data.profileSlug);
      }

      const updateData: Prisma.UserUpdateManyMutationInput = {
        ...data,
      };

      try {
        const result = await db.user.updateMany({
          where: { id: tenant.userId },
          data: updateData,
        });

        if (result.count === 0) {
          throw new TenantAccessDeniedError();
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ProfileSlugConflictError();
        }

        throw error;
      }

      return get(tenant);
    },

    async completeOnboarding(tenant: TenantContext, data: OnboardingInput) {
      const result = await db.user.updateMany({
        where: { id: tenant.userId },
        data: {
          displayName: data.displayName,
          profileBio: data.profileBio,
          profileVisibility: data.profileVisibility,
          searchIndexingEnabled: data.searchIndexingEnabled,
          timezone: data.timezone,
          onboardingCompletedAt: new Date(),
        },
      });

      if (result.count === 0) {
        throw new TenantAccessDeniedError();
      }

      return get(tenant);
    },
  };
}

export type UserProfileService = ReturnType<typeof createUserProfileService>;
