import type { ActivityDetail, UserSettings } from "@/generated/prisma/client";

export type UserSettingsDto = {
  summariesEnabled: boolean;
  allowPrivateMetadataForLlm: boolean;
  summaryProvider: string | null;
  summaryModel: string | null;
  defaultActivityDetail: ActivityDetail;
};

export function toUserSettingsDto(settings: UserSettings): UserSettingsDto {
  return {
    summariesEnabled: settings.summariesEnabled,
    allowPrivateMetadataForLlm: settings.allowPrivateMetadataForLlm,
    summaryProvider: settings.summaryProvider,
    summaryModel: settings.summaryModel,
    defaultActivityDetail: settings.defaultActivityDetail,
  };
}
