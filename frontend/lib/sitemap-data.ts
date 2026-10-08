import { getAreaHref, getAreaIndexHref } from "@/lib/areas";
import type { SitemapUrlEntry } from "@/lib/sitemap-xml";
import { fetchAllPropertiesSafe, fetchBlogPostsSafe, fetchSearchFilterNeighborhoodsSafe } from "@/lib/server-api";
import { fetchComparePairsSafe, fetchRentalsSitemapSafe, fetchResearchChartsSafe } from "@/lib/market-api";

export const SITEMAP_REVALIDATE_SECONDS = 3600;

/** Paths owned by sitemap-pages.xml — must not appear in other child sitemaps. */
const PAGES_OWNED_RENTAL_PATHS = new Set(["/rentals", "/rentals/kigali"]);

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

/** Most recent valid date; lastmod must reflect real content changes, so there is no "now" fallback. */
function latestSitemapDate(...values: (string | Date | null | undefined)[]): Date | undefined {
  let latest: Date | undefined;
  for (const value of values) {
    const d = parseSitemapDate(value);
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).pathname.replace(/\/+$/, "") || "/";
    }
  } catch {
    /* ignore */
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

/**
 * Static / marketing pages only — no research, no individual blog/property/area/rental URLs.
 * Listing-driven pages get the newest listing/blog date; static pages omit lastmod.
 */
export async function getPagesSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const base = getSiteBaseUrl();
  const [properties, blogPosts] = await Promise.all([
    fetchAllPropertiesSafe({ revalidate: SITEMAP_REVALIDATE_SECONDS }),
    fetchBlogPostsSafe(),
  ]);
  const listingsUpdated = latestSitemapDate(
    ...properties.flatMap((p) => [p.updated_at, p.last_verified_at, p.published_at]),
  );
  const blogUpdated = latestSitemapDate(...blogPosts.flatMap((p) => [p.updated_at, p.published_at]));
  const homeUpdated = latestSitemapDate(listingsUpdated, blogUpdated);

  return [
    { loc: base, lastModified: homeUpdated, changeFrequency: "daily", priority: 1 },
    { loc: `${base}/properties`, lastModified: listingsUpdated, changeFrequency: "daily", priority: 0.9 },
    { loc: `${base}/rentals`, lastModified: listingsUpdated, changeFrequency: "weekly", priority: 0.88 },
    { loc: `${base}/rentals/kigali`, lastModified: listingsUpdated, changeFrequency: "weekly", priority: 0.87 },
    { loc: `${base}${getAreaIndexHref()}`, changeFrequency: "weekly", priority: 0.85 },
    { loc: `${base}/about`, changeFrequency: "monthly", priority: 0.7 },
    { loc: `${base}/blog`, lastModified: blogUpdated, changeFrequency: "weekly", priority: 0.8 },
    { loc: `${base}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { loc: `${base}/contact`, changeFrequency: "monthly", priority: 0.7 },
    { loc: `${base}/agents`, changeFrequency: "monthly", priority: 0.6 },
    { loc: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { loc: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { loc: `${base}/sitemap`, changeFrequency: "weekly", priority: 0.4 },
  ];
}

/** Individual area pages only (/area/{slug}). Index /area stays in pages. */
export async function getAreasSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const neighborhoods = await fetchSearchFilterNeighborhoodsSafe();
  return neighborhoods
    .map((area) => {
      const slug = String(area.slug || "").trim();
      if (!slug) return null;
      return entryFromPath(getAreaHref(slug), {
        changeFrequency: "weekly",
        priority: 0.75,
      });
    })
    .filter((e): e is SitemapUrlEntry => Boolean(e));
}

/** Individual property listing pages only (/properties/{slug}). */
export async function getPropertiesSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const properties = await fetchAllPropertiesSafe({ revalidate: SITEMAP_REVALIDATE_SECONDS });

  return properties
    .map((property) => {
      const slug = String(property.slug || property.id || "").trim();
      if (!slug) return null;
      return entryFromPath(`/properties/${encodeURIComponent(slug)}`, {
        lastModified: latestSitemapDate(
          property.updated_at,
          property.last_verified_at,
          property.published_at,
          property.created_at,
        ),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    })
    .filter((e): e is SitemapUrlEntry => Boolean(e));
}

/** Individual blog articles only. /blog index lives in sitemap-pages.xml. */
export async function getBlogSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const blogPosts = await fetchBlogPostsSafe();
  const entries: SitemapUrlEntry[] = [];

  for (const post of blogPosts) {
    const slug = String(post?.slug || "").trim();
    if (!slug || slug === "undefined" || slug === "null") continue;
    const entry = entryFromPath(`/blog/${encodeURIComponent(slug)}`, {
      lastModified: latestSitemapDate(post.updated_at, post.published_at),
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

/**
 * Whether a /rentals/... path belongs in sitemap-rentals.xml.
 * Excludes /rentals and /rentals/kigali (owned by sitemap-pages.xml).
 * Includes neighborhood hubs (/rentals/{hood}) and search intents (/rentals/{loc}/{intent}).
 */
export function isRentalsSitemapPath(path: string): boolean {
  const normalized = normalizePath(path);
  if (!normalized.startsWith("/rentals/")) return false;
  if (PAGES_OWNED_RENTAL_PATHS.has(normalized)) return false;
  const parts = normalized.split("/").filter(Boolean);
  // /rentals/{location} or /rentals/{location}/{intent}
  return parts.length >= 2;
}

/**
 * Rental search / neighborhood rental URLs only (/rentals/{...}).
 * Never includes /properties/... or pages-owned /rentals|/rentals/kigali.
 */
export async function getRentalsSitemapEntries(
  options?: { debug?: boolean },
): Promise<{ entries: SitemapUrlEntry[]; meta: RentalsSitemapMeta }> {
  const { data, error, apiUrl } = await fetchRentalsSitemapSafe({ debug: options?.debug });

  if (!data) {
    // Do not fall back to /rentals or /rentals/kigali (those are in pages).
    // Prefer neighborhood rental hubs from locations data when API is down.
    const neighborhoods = await fetchSearchFilterNeighborhoodsSafe();
    const fallback = neighborhoods
      .map((area) => {
        const slug = String(area.slug || "").trim().toLowerCase();
        if (!slug || slug === "kigali") return null;
        const path = `/rentals/${encodeURIComponent(slug)}`;
        if (!isRentalsSitemapPath(path)) return null;
        return entryFromPath(path, {
          changeFrequency: "weekly",
          priority: 0.8,
        });
      })
      .filter((e): e is SitemapUrlEntry => Boolean(e));

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
  let hubCount = 0;
  let intentCount = 0;

  for (const item of data.items || []) {
    const path = normalizePath(String(item?.path || ""));
    if (!isRentalsSitemapPath(path)) continue;

    const segments = path.split("/").filter(Boolean).length;
    const isIntent = segments >= 3;
    if (isIntent) intentCount += 1;
    else hubCount += 1;

    const entry = entryFromPath(path, {
      lastModified: parseSitemapDate(item.last_built_at),
      changeFrequency: "weekly",
      priority: isIntent ? 0.85 : 0.8,
    });
    if (entry) entries.push(entry);
  }

  return {
    entries,
    meta: {
      apiUrl,
      count: entries.length,
      hubCount,
      intentCount,
      diagnostics: data.diagnostics,
      ...(error ? { error } : {}),
    },
  };
}

/**
 * Research product pages only.
 * There is no /research index route; hub is /research/kigali-rental-market.
 */
export async function getResearchSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const charts = await fetchResearchChartsSafe();
  const researchUpdated = latestSitemapDate(
    charts?.about?.last_updated,
    charts?.last_updated,
    charts?.citation?.last_updated,
  );
  const paths = [
    "/research/kigali-rental-market",
    "/research/kigali-rental-market/prices",
    "/research/kigali-rental-market/neighborhoods",
    "/research/kigali-rental-market/compare",
    "/research/kigali-rental-market/trends",
    "/research/kigali-rental-market/methodology",
    "/research/kigali-rental-market/sources",
    "/research/kigali-rental-market/reports",
  ];
  return paths
    .map((path) =>
      entryFromPath(path, {
        lastModified: path.endsWith("/methodology") || path.endsWith("/sources") ? undefined : researchUpdated,
        changeFrequency: "weekly",
        priority: path.endsWith("/kigali-rental-market") ? 0.8 : 0.75,
      }),
    )
    .filter((e): e is SitemapUrlEntry => Boolean(e));
}

/** Neighborhood vs neighborhood pages; only pairs the API deems data-backed. */
export async function getCompareSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const data = await fetchComparePairsSafe();
  return (data?.items || [])
    .map((pair) =>
      entryFromPath(`/research/kigali-rental-market/compare/${encodeURIComponent(pair.slug)}`, {
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    )
    .filter((e): e is SitemapUrlEntry => Boolean(e));
}

export function getSitemapIndexEntries() {
  const base = getSiteBaseUrl();
  return [
    { loc: `${base}/sitemap-pages.xml` },
    { loc: `${base}/sitemap-areas.xml` },
    { loc: `${base}/sitemap-properties.xml` },
    { loc: `${base}/sitemap-rentals.xml` },
    { loc: `${base}/sitemap-research.xml` },
    { loc: `${base}/sitemap-blog.xml` },
  ];
}
