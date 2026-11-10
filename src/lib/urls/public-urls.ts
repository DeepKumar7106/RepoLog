export function publicProfilePath(profileSlug: string): string {
  return `/u/${encodeURIComponent(profileSlug)}`;
}

export function publicProjectPath(profileSlug: string, projectSlug: string): string {
  return `${publicProfilePath(profileSlug)}/projects/${encodeURIComponent(projectSlug)}`;
}

export function absolutePublicUrl(path: string, baseUrl: string): string {
  return new URL(path, baseUrl).toString();
}
