import type { MetadataRoute } from "next";
import { absolutePublicUrl, publicProfilePath, publicProjectPath } from "@/lib/urls/public-urls";
import { env } from "@/lib/validation/env";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await services.publicProfiles.listPublicEntries();

  return entries.map((entry) => ({
    url: absolutePublicUrl(
      entry.projectSlug
        ? publicProjectPath(entry.profileSlug, entry.projectSlug)
        : publicProfilePath(entry.profileSlug),
      env.APP_BASE_URL,
    ),
    lastModified: entry.updatedAt,
    changeFrequency: entry.projectSlug ? "weekly" : "daily",
    priority: entry.projectSlug ? 0.6 : 0.8,
  }));
}
