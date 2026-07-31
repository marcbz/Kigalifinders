import type { HomepageData, PaginatedResponse, PropertyDetail, PropertyListItem } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/** Always fetch fresh data from the API — no Next.js static cache. */
async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchHomepage() {
  return fetchApi<HomepageData>("/homepage");
}

export function fetchProperty(slug: string) {
  return fetchApi<PropertyDetail>(`/properties/${slug}`);
}

export function fetchRelated(slug: string) {
  return fetchApi<PropertyListItem[]>(`/properties/${slug}/related`);
}

export function fetchProperties(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const query = qs.toString();
  return fetchApi<PaginatedResponse<PropertyListItem>>(`/properties${query ? `?${query}` : ""}`);
}

export function fetchFaqs() {
  return fetchApi<{ id: string; question: string; answer: string; category?: string }[]>("/faqs");
}

export function fetchBlogPosts() {
  return fetchApi<{ id: string; title: string; slug: string; excerpt?: string; featured_image?: string }[]>("/blog");
}
