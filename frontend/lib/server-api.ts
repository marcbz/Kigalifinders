import { unstable_cache } from "next/cache";
import type { HomepageData, PaginatedResponse, PropertyDetail, PropertyListItem } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function fetchJson<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    next: { revalidate },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export const getCachedHomepage = unstable_cache(
  () => fetchJson<HomepageData>("/homepage", 120),
  ["homepage-data"],
  { revalidate: 120 },
);

export async function getCachedProperty(slug: string) {
  return fetchJson<PropertyDetail>(`/properties/${slug}`, 60);
}

export async function getCachedRelated(slug: string) {
  return fetchJson<PropertyListItem[]>(`/properties/${slug}/related`, 60);
}

export async function getCachedProperties(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const query = qs.toString();
  return fetchJson<PaginatedResponse<PropertyListItem>>(`/properties${query ? `?${query}` : ""}`, 60);
}
