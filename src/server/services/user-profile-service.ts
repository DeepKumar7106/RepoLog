import type { Visibility } from "@/generated/prisma/enums";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import { TenantAccessDeniedError, type TenantContext } from "@/lib/tenancy/tenant-context";

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

  return {
    get,

    async update(tenant: TenantContext, data: UserProfileUpdate) {
      const result = await db.user.updateMany({
        where: { id: tenant.userId },
        data,
      });

      if (result.count === 0) {
        throw new TenantAccessDeniedError();
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
