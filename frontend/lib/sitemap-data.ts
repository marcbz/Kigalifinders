import { getAreaHref, getAreaIndexHref } from "@/lib/areas";
import type { SitemapUrlEntry } from "@/lib/sitemap-xml";
import { fetchAllPropertiesSafe, fetchBlogPostsSafe, fetchSearchFilterNeighborhoodsSafe } from "@/lib/server-api";
import { fetchRentalsSitemapSafe } from "@/lib/market-api";

export const SITEMAP_REVALIDATE_SECONDS = 3600;

export function getSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";
}

export function getPagesSitemapEntries(now = new Date()): SitemapUrlEntry[] {
  const base = getSiteBaseUrl();
  return [
    { loc: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { loc: `${base}/properties`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { loc: `${base}/rentals`, lastModified: now, changeFrequency: "weekly", priority: 0.88 },
    { loc: `${base}/rentals/kigali`, lastModified: now, changeFrequency: "weekly", priority: 0.87 },
    { loc: `${base}${getAreaIndexHref()}`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { loc: `${base}/research/kigali-rental-market`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { loc: `${base}/research/kigali-rental-market/prices`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { loc: `${base}/research/kigali-rental-market/neighborhoods`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { loc: `${base}/research/kigali-rental-market/trends`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { loc: `${base}/research/kigali-rental-market/methodology`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { loc: `${base}/research/kigali-rental-market/sources`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { loc: `${base}/research/kigali-rental-market/reports`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
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

export type RentalsSitemapMeta = {
  apiUrl: string;
  count: number;
  hubCount?: number;
  intentCount?: number;
  error?: string;
  diagnostics?: Record<string, unknown>;
};

export async function getRentalsSitemapEntries(
  now = new Date(),
  options?: { debug?: boolean },
): Promise<{ entries: SitemapUrlEntry[]; meta: RentalsSitemapMeta }> {
  const base = getSiteBaseUrl();
  const { data, error, apiUrl } = await fetchRentalsSitemapSafe({ debug: options?.debug });

  if (!data) {
    return {
      entries: [],
      meta: { apiUrl, count: 0, error: error || "upstream_empty" },
    };
  }

  const entries = (data.items || []).map((item) => ({
    loc: `${base}${item.path}`,
    lastModified: item.last_built_at ? new Date(item.last_built_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  return {
    entries,
    meta: {
      apiUrl,
      count: entries.length,
      hubCount: data.hub_count,
      intentCount: data.intent_count,
      diagnostics: data.diagnostics,
    },
  };
}

export function getResearchSitemapEntries(now = new Date()): SitemapUrlEntry[] {
  const base = getSiteBaseUrl();
  const paths = [
    "/research/kigali-rental-market",
    "/research/kigali-rental-market/prices",
    "/research/kigali-rental-market/neighborhoods",
    "/research/kigali-rental-market/trends",
    "/research/kigali-rental-market/methodology",
    "/research/kigali-rental-market/sources",
    "/research/kigali-rental-market/reports",
  ];
  return paths.map((path) => ({
    loc: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));
}

export function getSitemapIndexEntries(now = new Date()) {
  const base = getSiteBaseUrl();
  return [
    { loc: `${base}/sitemap-pages.xml`, lastModified: now },
    { loc: `${base}/sitemap-areas.xml`, lastModified: now },
    { loc: `${base}/sitemap-properties.xml`, lastModified: now },
    { loc: `${base}/sitemap-rentals.xml`, lastModified: now },
    { loc: `${base}/sitemap-research.xml`, lastModified: now },
    { loc: `${base}/sitemap-blog.xml`, lastModified: now },
  ];
}
