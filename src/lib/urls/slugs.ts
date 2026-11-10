const MAX_SLUG_LENGTH = 39;

/**
 * Normalizes a profile or project slug into a stable, URL-safe value.
 *
 * Slugs are lowercase, use single hyphens as separators and are bounded to the
 * same length as a GitHub login so the default slug can always be used.
 */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export function isValidSlug(input: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input) && input.length <= MAX_SLUG_LENGTH;
}
