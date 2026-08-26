import { cache } from "react";
import { neighborhoodsForSearchFilter } from "@/lib/neighborhood-groups";
import type { HomepageData, PaginatedResponse, PropertyDetail, PropertyListItem } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const DEFAULT_REVALIDATE = 60;
const FETCH_TIMEOUT_MS = 8000;

const emptyHomepage = (): HomepageData => ({
  stats: { properties_listed: 0, happy_clients: 0, years_experience: 0, client_rating: 0 },
  featured_properties: [],
  featured_furnished: [],
  featured_plots: [],
  testimonials: [],
  districts: [],
  neighborhoods: [],
  blog_posts: [],
  faqs: [],
  hero: {},
  settings: {},
  links: {},
  social: {},
});

type FetchOptions = {
  revalidate?: number;
  noStore?: boolean;
};

/** Fetch from the API with caching. Returns null on failure instead of throwing. */
async function fetchApiSafe<T>(path: string, options: FetchOptions = {}): Promise<T | null> {
  const { revalidate = DEFAULT_REVALIDATE, noStore = false } = options;

  if (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV === "production") {
    console.error("[server-api] NEXT_PUBLIC_API_URL is not set on Vercel");
    return null;
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...(noStore ? { cache: "no-store" as const } : { next: { revalidate } }),
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[server-api] ${path} failed: ${res.status}`);
      return null;
    }
    return res.json() as Promise<T>;
  } catch (err) {
    console.error(`[server-api] ${path} error:`, err);
    return null;
  }
}

async function fetchApi<T>(path: string, options?: FetchOptions): Promise<T> {
  const data = await fetchApiSafe<T>(path, options);
  if (!data) throw new Error(`Failed to load ${path}`);
  return data;
}

export const fetchHomepageSafe = cache(async (): Promise<{ data: HomepageData; ok: boolean }> => {
  const data = await fetchApiSafe<HomepageData>("/homepage", { revalidate: 120 });
  if (data) return { data, ok: true };
  return { data: emptyHomepage(), ok: false };
});

export function fetchHomepage() {
  return fetchApi<HomepageData>("/homepage", { revalidate: 120 });
}

export async function fetchPropertySafe(slug: string) {
  const normalized = encodeURIComponent(slug.trim());
  return fetchApiSafe<PropertyDetail>(`/properties/${normalized}`, { noStore: true });
}

export function fetchProperty(slug: string) {
  const normalized = encodeURIComponent(slug.trim());
  return fetchApi<PropertyDetail>(`/properties/${normalized}`, { revalidate: DEFAULT_REVALIDATE });
}

export async function fetchRelatedSafe(slug: string, page = 1, pageSize = 12) {
  const normalized = encodeURIComponent(slug.trim());
  const data = await fetchApiSafe<PaginatedResponse<PropertyListItem>>(
    `/properties/${normalized}/related?page=${page}&page_size=${pageSize}`,
    { revalidate: DEFAULT_REVALIDATE },
  );
  return data ?? { items: [], total: 0, page: 1, page_size: pageSize, pages: 0 };
}

export function fetchRelated(slug: string, page = 1, pageSize = 12) {
  const normalized = encodeURIComponent(slug.trim());
  return fetchApi<PaginatedResponse<PropertyListItem>>(
    `/properties/${normalized}/related?page=${page}&page_size=${pageSize}`,
    { revalidate: DEFAULT_REVALIDATE },
  );
}

export type PropertyRelatedRentalSearch = {
  path: string;
  title: string;
  h1: string;
  match_count?: number;
  location_slug?: string;
  intent_slug?: string;
};

export async function fetchPropertyRelatedSearchesSafe(slug: string, limit = 6) {
  const normalized = encodeURIComponent(slug.trim());
  const data = await fetchApiSafe<{ items: PropertyRelatedRentalSearch[]; count: number }>(
    `/properties/${normalized}/related-searches?limit=${Math.min(Math.max(limit, 1), 6)}`,
    { revalidate: DEFAULT_REVALIDATE },
  );
  return (data?.items || []).slice(0, 6);
}

export async function fetchPropertiesSafe(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  if (qs.has("page_size")) {
    const pageSize = Number(qs.get("page_size"));
    if (!Number.isNaN(pageSize)) qs.set("page_size", String(Math.min(Math.max(pageSize, 1), 100)));
  }
  const query = qs.toString();
  const data = await fetchApiSafe<PaginatedResponse<PropertyListItem>>(
    `/properties${query ? `?${query}` : ""}`,
    { revalidate: DEFAULT_REVALIDATE },
  );
  return data ?? { items: [], total: 0, page: 1, page_size: 12, pages: 0 };
}

/** Fetch every published property page-by-page (API max page_size is 100). */
export async function fetchAllPropertiesSafe(options: FetchOptions = { revalidate: 300 }): Promise<PropertyListItem[]> {
  const all: PropertyListItem[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await fetchApiSafe<PaginatedResponse<PropertyListItem>>(
      `/properties?page=${page}&page_size=100`,
      options,
    );
    if (!data) break;
    all.push(...data.items);
    totalPages = data.pages || 1;
    page += 1;
  }

  return all;
}

export function fetchProperties(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const query = qs.toString();
  return fetchApi<PaginatedResponse<PropertyListItem>>(
    `/properties${query ? `?${query}` : ""}`,
    { revalidate: DEFAULT_REVALIDATE },
  );
}

export async function fetchFaqsSafe() {
  const data = await fetchApiSafe<{ id: string; question: string; answer: string; category?: string }[]>("/faqs", {
    revalidate: 300,
  });
  return data ?? [];
}

export function fetchFaqs() {
  return fetchApi<{ id: string; question: string; answer: string; category?: string }[]>("/faqs", {
    revalidate: 300,
  });
}

export async function fetchBlogPostsSafe() {
  const data = await fetchApiSafe<{ id: string; title: string; slug: string; excerpt?: string; featured_image?: string }[]>(
    "/blog",
    { revalidate: 120 },
  );
  return data ?? [];
}

export function fetchBlogPosts() {
  return fetchApi<{ id: string; title: string; slug: string; excerpt?: string; featured_image?: string }[]>("/blog", {
    revalidate: 120,
  });
}

export type LegalContent = {
  privacy_policy: string;
  terms_of_service: string;
  sitemap_intro: string;
};

const emptyLegal = (): LegalContent => ({
  privacy_policy: "",
  terms_of_service: "",
  sitemap_intro: "",
});

export async function fetchLegalSafe(): Promise<LegalContent> {
  const data = await fetchApiSafe<LegalContent>("/legal", { revalidate: 60 });
  return data ?? emptyLegal();
}

export type NeighborhoodSummary = {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
  property_count: number;
  district_name?: string | null;
};

export async function fetchNeighborhoodsSafe(): Promise<NeighborhoodSummary[]> {
  const data = await fetchApiSafe<NeighborhoodSummary[]>("/locations/neighborhoods", { revalidate: 300 });
  return data ?? [];
}

export async function fetchNeighborhoodBySlugSafe(slug: string): Promise<NeighborhoodSummary | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const neighborhoods = await fetchSearchFilterNeighborhoodsSafe();
  return neighborhoods.find((area) => area.slug === normalized) ?? null;
}

export async function fetchSearchFilterNeighborhoodsSafe(): Promise<NeighborhoodSummary[]> {
  const neighborhoods = await fetchNeighborhoodsSafe();
  return neighborhoodsForSearchFilter(neighborhoods);
}
