import { getAreaHref, getAreaIndexHref } from "@/lib/areas";
import type { SitemapUrlEntry } from "@/lib/sitemap-xml";
import { fetchAllPropertiesSafe, fetchBlogPostsSafe, fetchSearchFilterNeighborhoodsSafe } from "@/lib/server-api";

export const SITEMAP_REVALIDATE_SECONDS = 3600;

export function getSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.kigalirent.com";
}

export function getPagesSitemapEntries(now = new Date()): SitemapUrlEntry[] {
  const base = getSiteBaseUrl();
  return [
    { loc: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { loc: `${base}/properties`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { loc: `${base}${getAreaIndexHref()}`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { loc: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { loc: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { loc: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { loc: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { loc: `${base}/agents`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { loc: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { loc: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { loc: `${base}/sitemap`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
  ];
}

export async function getAreasSitemapEntries(now = new Date()): Promise<SitemapUrlEntry[]> {
  const base = getSiteBaseUrl();
  const neighborhoods = await fetchSearchFilterNeighborhoodsSafe();
  return neighborhoods.map((area) => ({
    loc: `${base}${getAreaHref(area.slug)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));
}

export async function getPropertiesSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const base = getSiteBaseUrl();
  const properties = await fetchAllPropertiesSafe({ revalidate: SITEMAP_REVALIDATE_SECONDS });
  const now = new Date();

  return properties.map((property) => ({
    loc: `${base}/properties/${encodeURIComponent(property.slug || property.id)}`,
    lastModified: property.published_at ? new Date(property.published_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}

export async function getBlogSitemapEntries(now = new Date()): Promise<SitemapUrlEntry[]> {
  const base = getSiteBaseUrl();
  const blogPosts = await fetchBlogPostsSafe();
  return blogPosts.map((post) => ({
    loc: `${base}/blog/${encodeURIComponent(post.slug)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}

export function getSitemapIndexEntries(now = new Date()) {
  const base = getSiteBaseUrl();
  return [
    { loc: `${base}/sitemap-pages.xml`, lastModified: now },
    { loc: `${base}/sitemap-areas.xml`, lastModified: now },
    { loc: `${base}/sitemap-properties.xml`, lastModified: now },
    { loc: `${base}/sitemap-blog.xml`, lastModified: now },
  ];
}
