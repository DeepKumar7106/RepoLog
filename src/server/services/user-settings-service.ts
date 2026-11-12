import type { ActivityDetail } from "@/generated/prisma/enums";
import type { AppPrismaClient } from "@/lib/db/prisma-factory";
import type { TenantContext } from "@/lib/tenancy/tenant-context";

export type UserSettingsUpdate = {
  summariesEnabled?: boolean;
  allowPrivateMetadataForLlm?: boolean;
  summaryProvider?: string | null;
  summaryModel?: string | null;
  defaultActivityDetail?: ActivityDetail;
};

export function createUserSettingsService(db: AppPrismaClient) {
  async function get(tenant: TenantContext) {
    return db.userSettings.upsert({
      where: { userId: tenant.userId },
      update: {},
      create: { userId: tenant.userId },
    });
  }

  return {
    get,

    async update(tenant: TenantContext, data: UserSettingsUpdate) {
      const settings = await db.userSettings.upsert({
        where: { userId: tenant.userId },
        update: data,
        create: { userId: tenant.userId, ...data },
      });

      if (data.summariesEnabled === false) {
        await db.dailySummary.deleteMany({
          where: { userId: tenant.userId },
        });
      } else if (data.allowPrivateMetadataForLlm === false) {
        await db.dailySummary.deleteMany({
          where: { userId: tenant.userId, scope: "PRIVATE" },
        });
      }

      return settings;
    },
  };
}

export type UserSettingsService = ReturnType<typeof createUserSettingsService>;
