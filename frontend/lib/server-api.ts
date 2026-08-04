import type { HomepageData, PaginatedResponse, PropertyDetail, PropertyListItem } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
});

/** Fetch fresh data from the API. Returns null on failure instead of throwing. */
async function fetchApiSafe<T>(path: string): Promise<T | null> {
  if (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV === "production") {
    console.error("[server-api] NEXT_PUBLIC_API_URL is not set on Vercel");
    return null;
  }
  try {
    const res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25000),
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

async function fetchApi<T>(path: string): Promise<T> {
  const data = await fetchApiSafe<T>(path);
  if (!data) throw new Error(`Failed to load ${path}`);
  return data;
}

export async function fetchHomepageSafe(): Promise<{ data: HomepageData; ok: boolean }> {
  const data = await fetchApiSafe<HomepageData>("/homepage");
  if (data) return { data, ok: true };
  return { data: emptyHomepage(), ok: false };
}

export function fetchHomepage() {
  return fetchApi<HomepageData>("/homepage");
}

export async function fetchPropertySafe(slug: string) {
  return fetchApiSafe<PropertyDetail>(`/properties/${slug}`);
}

export function fetchProperty(slug: string) {
  return fetchApi<PropertyDetail>(`/properties/${slug}`);
}

export async function fetchRelatedSafe(slug: string, page = 1, pageSize = 12) {
  const data = await fetchApiSafe<PaginatedResponse<PropertyListItem>>(
    `/properties/${slug}/related?page=${page}&page_size=${pageSize}`,
  );
  return data ?? { items: [], total: 0, page: 1, page_size: pageSize, pages: 0 };
}

export function fetchRelated(slug: string, page = 1, pageSize = 12) {
  return fetchApi<PaginatedResponse<PropertyListItem>>(
    `/properties/${slug}/related?page=${page}&page_size=${pageSize}`,
  );
}

export async function fetchPropertiesSafe(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const query = qs.toString();
  const data = await fetchApiSafe<PaginatedResponse<PropertyListItem>>(
    `/properties${query ? `?${query}` : ""}`,
  );
  return data ?? { items: [], total: 0, page: 1, page_size: 12, pages: 0 };
}

export function fetchProperties(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const query = qs.toString();
  return fetchApi<PaginatedResponse<PropertyListItem>>(`/properties${query ? `?${query}` : ""}`);
}

export async function fetchFaqsSafe() {
  const data = await fetchApiSafe<{ id: string; question: string; answer: string; category?: string }[]>("/faqs");
  return data ?? [];
}

export function fetchFaqs() {
  return fetchApi<{ id: string; question: string; answer: string; category?: string }[]>("/faqs");
}

export async function fetchBlogPostsSafe() {
  const data = await fetchApiSafe<{ id: string; title: string; slug: string; excerpt?: string; featured_image?: string }[]>("/blog");
  return data ?? [];
}

export function fetchBlogPosts() {
  return fetchApi<{ id: string; title: string; slug: string; excerpt?: string; featured_image?: string }[]>("/blog");
}
