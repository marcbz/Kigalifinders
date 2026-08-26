import { getAreaHref, getAreaIndexHref } from "@/lib/areas";
import type { SitemapUrlEntry } from "@/lib/sitemap-xml";
import { fetchAllPropertiesSafe, fetchBlogPostsSafe, fetchSearchFilterNeighborhoodsSafe } from "@/lib/server-api";
import { fetchRentalsSitemapSafe } from "@/lib/market-api";

export const SITEMAP_REVALIDATE_SECONDS = 3600;

export function getSiteBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com").trim();
  return raw.replace(/\/+$/, "") || "https://kigalirent.com";
}

/** Join site base with a path that may be relative or already absolute. */
export function absoluteSitemapUrl(pathOrUrl: string, base = getSiteBaseUrl()): string | null {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.toString();
    }
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return new URL(path, `${base}/`).toString();
  } catch {
    return null;
  }
}

function entryFromPath(
  pathOrUrl: string,
  opts: {
    lastModified?: Date;
    changeFrequency?: SitemapUrlEntry["changeFrequency"];
    priority?: number;
  } = {},
): SitemapUrlEntry | null {
  const loc = absoluteSitemapUrl(pathOrUrl);
  if (!loc) return null;
  return {
    loc,
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
  };
}

function parseSitemapDate(value?: string | Date | null, fallback?: Date): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
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
  const neighborhoods = await fetchSearchFilterNeighborhoodsSafe();
  return neighborhoods
    .map((area) => {
      const slug = String(area.slug || "").trim();
      if (!slug) return null;
      return entryFromPath(getAreaHref(slug), {
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    })
    .filter((e): e is SitemapUrlEntry => Boolean(e));
}

export async function getPropertiesSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const properties = await fetchAllPropertiesSafe({ revalidate: SITEMAP_REVALIDATE_SECONDS });
  const now = new Date();

  return properties
    .map((property) => {
      const slug = String(property.slug || property.id || "").trim();
      if (!slug) return null;
      return entryFromPath(`/properties/${encodeURIComponent(slug)}`, {
        lastModified: parseSitemapDate(property.published_at, now),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    })
    .filter((e): e is SitemapUrlEntry => Boolean(e));
}

export async function getBlogSitemapEntries(now = new Date()): Promise<SitemapUrlEntry[]> {
  const blogPosts = await fetchBlogPostsSafe();
  const entries: SitemapUrlEntry[] = [];

  // Always include the blog index so the sitemap never has zero <url> nodes.
  const hub = entryFromPath("/blog", {
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  });
  if (hub) entries.push(hub);

  for (const post of blogPosts) {
    const slug = String(post?.slug || "").trim();
    if (!slug || slug === "undefined" || slug === "null") continue;
    const entry = entryFromPath(`/blog/${encodeURIComponent(slug)}`, {
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
    if (entry) entries.push(entry);
  }

  return entries;
}

export type RentalsSitemapMeta = {
  apiUrl: string;
  count: number;
  hubCount?: number;
  intentCount?: number;
  error?: string;
  diagnostics?: Record<string, unknown>;
};

function rentalsFallbackEntries(now: Date): SitemapUrlEntry[] {
  return [
    entryFromPath("/rentals", { lastModified: now, changeFrequency: "weekly", priority: 0.88 }),
    entryFromPath("/rentals/kigali", { lastModified: now, changeFrequency: "weekly", priority: 0.87 }),
  ].filter((e): e is SitemapUrlEntry => Boolean(e));
}

export async function getRentalsSitemapEntries(
  now = new Date(),
  options?: { debug?: boolean },
): Promise<{ entries: SitemapUrlEntry[]; meta: RentalsSitemapMeta }> {
  const { data, error, apiUrl } = await fetchRentalsSitemapSafe({ debug: options?.debug });

  if (!data) {
    // Never return an empty sitemap — keep hub URLs available for crawlers even if API is down.
    const fallback = rentalsFallbackEntries(now);
    return {
      entries: fallback,
      meta: {
        apiUrl,
        count: fallback.length,
        hubCount: fallback.length,
        intentCount: 0,
        error: error || "upstream_empty",
      },
    };
  }

  const entries: SitemapUrlEntry[] = [];
  for (const item of data.items || []) {
    const path = String(item?.path || "").trim();
    if (!path) continue;
    // Accept hub (/rentals, /rentals/{loc}) and intent (/rentals/{loc}/{intent}) paths
    if (!path.startsWith("/rentals")) continue;
    const entry = entryFromPath(path, {
      lastModified: parseSitemapDate(item.last_built_at, now),
      changeFrequency: "weekly",
      priority: path.split("/").filter(Boolean).length >= 3 ? 0.85 : 0.8,
    });
    if (entry) entries.push(entry);
  }

  // Guarantee hubs even if upstream omitted them
  const withHubs = [...rentalsFallbackEntries(now), ...entries];

  return {
    entries: withHubs,
    meta: {
      apiUrl,
      count: withHubs.length,
      hubCount: data.hub_count,
      intentCount: data.intent_count,
      diagnostics: data.diagnostics,
    },
  };
}

export function getResearchSitemapEntries(now = new Date()): SitemapUrlEntry[] {
  const paths = [
    "/research/kigali-rental-market",
    "/research/kigali-rental-market/prices",
    "/research/kigali-rental-market/neighborhoods",
    "/research/kigali-rental-market/trends",
    "/research/kigali-rental-market/methodology",
    "/research/kigali-rental-market/sources",
    "/research/kigali-rental-market/reports",
  ];
  return paths
    .map((path) =>
      entryFromPath(path, {
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.75,
      }),
    )
    .filter((e): e is SitemapUrlEntry => Boolean(e));
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
