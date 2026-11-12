import type { MetadataRoute } from "next";
import { env } from "@/lib/validation/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/onboarding", "/api/"],
      },
    ],
    sitemap: `${env.APP_BASE_URL}/sitemap.xml`,
    host: env.APP_BASE_URL,
  };
}
