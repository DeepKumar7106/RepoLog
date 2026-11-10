export type VisibilityValue = "PUBLIC" | "PRIVATE";
export type ActivityDetailValue = "HIDDEN" | "AGGREGATED" | "COMMIT_DETAILS";

export function isProfilePublic(profileVisibility: VisibilityValue): boolean {
  return profileVisibility === "PUBLIC";
}

/**
 * A project is publicly reachable only when both the owning profile and the
 * project itself are public. A public project must never override a private
 * profile.
 */
export function isProjectPubliclyVisible(
  profileVisibility: VisibilityValue,
  projectVisibility: VisibilityValue,
): boolean {
  return profileVisibility === "PUBLIC" && projectVisibility === "PUBLIC";
}

export function canExposeCommitDetails(
  profileVisibility: VisibilityValue,
  projectVisibility: VisibilityValue,
  activityDetail: ActivityDetailValue,
): boolean {
  return (
    isProjectPubliclyVisible(profileVisibility, projectVisibility) &&
    activityDetail === "COMMIT_DETAILS"
  );
}
