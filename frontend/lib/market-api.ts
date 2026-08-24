import type { MarketSnapshot, SearchLandingPage } from "@/types/market";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const FETCH_TIMEOUT_MS = 8000;

async function fetchSafe<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function fetchRentalLandingSafe(location: string, intent: string) {
  return fetchSafe<SearchLandingPage>(
    `/rentals/${encodeURIComponent(location)}/${encodeURIComponent(intent)}`,
    300,
  );
}

export function fetchRentalsSitemapSafe() {
  return fetchSafe<{ items: { path: string; last_built_at?: string; title: string }[] }>(
    "/rentals/sitemap",
    3600,
  );
}

export function fetchResearchOverviewSafe() {
  return fetchSafe<{
    title: string;
    summary: string;
    last_updated?: string;
    verified_snapshots: MarketSnapshot[];
    observation_snapshots: MarketSnapshot[];
    activity_series: { month: string; observations: number }[];
    neighborhoods: MarketSnapshot[];
  }>("/research/kigali-rental-market", 600);
}

export function fetchResearchPricesSafe(location = "kigali") {
  return fetchSafe<{ items: MarketSnapshot[]; note: string }>(
    `/research/kigali-rental-market/prices?location_slug=${encodeURIComponent(location)}`,
    600,
  );
}

export function fetchResearchNeighborhoodsSafe() {
  return fetchSafe<{ items: MarketSnapshot[] }>("/research/kigali-rental-market/neighborhoods", 600);
}

export function fetchResearchTrendsSafe() {
  return fetchSafe<{
    median_series: { period_end: string; median_usd?: number; sample_size: number }[];
    observation_activity: { month: string; observations: number }[];
    disclaimer: string;
    summary: string;
  }>("/research/kigali-rental-market/trends", 600);
}

export function fetchResearchMethodologySafe() {
  return fetchSafe<{ title: string; body: string; rules: string[] }>(
    "/research/kigali-rental-market/methodology",
    3600,
  );
}

export function fetchResearchSourcesSafe() {
  return fetchSafe<{ sources: { source: string; observation_count: number | null; kind: string }[] }>(
    "/research/kigali-rental-market/sources",
    600,
  );
}

export function fetchResearchReportsSafe() {
  return fetchSafe<{ reports: { slug: string; title: string; path: string }[] }>(
    "/research/kigali-rental-market/reports",
    3600,
  );
}

export function fetchResearchChartsSafe() {
  return fetchSafe<{
    verified_label: string;
    external_label: string;
    external_disclaimer: string;
    external_active_count?: number;
    price_range: {
      verified: {
        typical?: number | null;
        typical_text?: string | null;
        range_text: string;
        sample_size: number;
        period_end?: string | null;
        label?: string;
      };
      external: {
        typical?: number | null;
        typical_text?: string | null;
        range_text: string;
        sample_size: number;
        period_end?: string | null;
        label?: string;
      };
    };
    by_bedroom: { bedrooms: number; median_usd?: number; p25_usd?: number; p75_usd?: number; sample_size: number }[];
    by_bedroom_external?: {
      bedrooms: number;
      median_usd?: number;
      p25_usd?: number;
      p75_usd?: number;
      sample_size: number;
    }[];
    by_neighborhood: {
      location_slug: string;
      label: string;
      median_usd?: number;
      p25_usd?: number;
      p75_usd?: number;
      sample_size: number;
    }[];
    by_neighborhood_external?: {
      location_slug: string;
      label: string;
      median_usd?: number;
      p25_usd?: number;
      p75_usd?: number;
      sample_size: number;
    }[];
    trend: { period_end: string; median_usd?: number; sample_size: number }[];
    trend_external?: { period_end: string; median_usd?: number; sample_size: number }[];
    observation_activity: { month: string; observations: number }[];
    has_trend_history: boolean;
    has_external_trend_history?: boolean;
    last_updated?: string | null;
  }>("/research/kigali-rental-market/charts", 60);
}
