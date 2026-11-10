import type { User, UserRole, Visibility } from "@/generated/prisma/client";

export type UserProfileDto = {
  id: string;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileSlug: string;
  profileBio: string | null;
  profileVisibility: Visibility;
  searchIndexingEnabled: boolean;
  timezone: string;
  role: UserRole;
  onboardingCompletedAt: string | null;
};

export function toUserProfileDto(user: User): UserProfileDto {
  return {
    id: user.id,
    githubLogin: user.githubLogin,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    profileSlug: user.profileSlug,
    profileBio: user.profileBio,
    profileVisibility: user.profileVisibility,
    searchIndexingEnabled: user.searchIndexingEnabled,
    timezone: user.timezone,
    role: user.role,
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
  };
}
