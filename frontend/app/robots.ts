import type { MetadataRoute } from "next";

const SITE = "https://kigalirent.com";

/**
 * Served at /robots.txt via the App Router so crawlers get a stable
 * text response even during static-asset cache transitions.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/go/", "/favorites"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
