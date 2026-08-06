import type { MetadataRoute } from "next";
import { getAreaHref, getAreaIndexHref } from "@/lib/areas";
import { fetchBlogPostsSafe, fetchPropertiesSafe, fetchSearchFilterNeighborhoodsSafe } from "@/lib/server-api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kigalirent.com";
  const now = new Date();

  const [properties, blogPosts, neighborhoods] = await Promise.all([
    fetchPropertiesSafe({ page_size: 500 }),
    fetchBlogPostsSafe(),
    fetchSearchFilterNeighborhoodsSafe(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/properties`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}${getAreaIndexHref()}`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/sitemap`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
  ];

  const propertyPages: MetadataRoute.Sitemap = properties.items.map((property) => ({
    url: `${base}/properties/${encodeURIComponent(property.slug || property.id)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const areaPages: MetadataRoute.Sitemap = neighborhoods.map((area) => ({
    url: `${base}${getAreaHref(area.slug)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${base}/blog/${encodeURIComponent(post.slug)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...areaPages, ...propertyPages, ...blogPages];
}
