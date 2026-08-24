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

export function fetchRentalDirectorySafe() {
  return fetchSafe<RentalHubData>("/rentals/directory", 300);
}

export function fetchRentalLocationSafe(location: string) {
  return fetchSafe<RentalHubData>(`/rentals/locations/${encodeURIComponent(location)}`, 300);
}

export type RentalHubData = import("@/components/rentals/rental-hub-page").RentalHubData;

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
  return fetchSafe<{
    items: (MarketSnapshot & { label?: string; bedrooms?: number })[];
    note: string;
    answer?: {
      question?: string;
      headline?: string | null;
      has_enough_data?: boolean;
      summary?: string;
      range_text?: string | null;
      sample_size?: number;
      last_updated_display?: string | null;
    };
  }>(`/research/kigali-rental-market/prices?location_slug=${encodeURIComponent(location)}`, 600);
}

export function fetchResearchNeighborhoodsSafe() {
  return fetchSafe<{ items: MarketSnapshot[] }>("/research/kigali-rental-market/neighborhoods", 600);
}

export function fetchResearchTrendsSafe() {
  return fetchSafe<{
    median_series: { period_end: string; median_usd?: number; sample_size: number }[];
    external_median_series?: { period_end: string; median_usd?: number; sample_size: number }[];
    observation_activity: { month: string; observations: number }[];
    disclaimer: string;
    summary: string;
    has_external_trend_history?: boolean;
    has_trend_history?: boolean;
    answer?: {
      question?: string;
      headline?: string | null;
      has_enough_data?: boolean;
      summary?: string;
      sample_size?: number;
    };
  }>("/research/kigali-rental-market/trends", 600);
}

export function fetchResearchMethodologySafe() {
  return fetchSafe<{
    title: string;
    body: string;
    rules: string[];
    labels?: { verified: string; external: string };
    transparency?: import("@/components/research/research-transparency").ResearchTransparencyData;
    import_batches?: {
      reference: string;
      imported_at: string;
      rows_processed: number;
      sources?: string[];
    }[];
  }>("/research/kigali-rental-market/methodology", 3600);
}

export function fetchResearchSourcesSafe() {
  return fetchSafe<{
    combined_summary?: string;
    sources: {
      source: string;
      source_key?: string | null;
      source_url?: string | null;
      observation_count: number | null;
      kind: string;
      attribution?: string;
    }[];
  }>("/research/kigali-rental-market/sources", 600);
}

export function fetchResearchReportsSafe() {
  return fetchSafe<{ reports: { slug: string; title: string; path: string }[] }>(
    "/research/kigali-rental-market/reports",
    3600,
  );
}

export function fetchResearchChartsSafe() {
  return fetchSafe<{
    title?: string;
    primary_answer?: {
      question?: string;
      headline?: string | null;
      has_enough_data?: boolean;
      summary?: string;
      range_text?: string | null;
      sample_size?: number;
      last_updated_display?: string | null;
      asking_rent_note?: string;
      typical_usd?: number | null;
    };
    bedroom_answers?: {
      question: string;
      headline?: string | null;
      sample_size?: number;
      last_updated_display?: string | null;
      has_enough_data?: boolean;
    }[];
    insights?: string[];
    about?: import("@/components/research/research-transparency").AboutThisData;
    citation?: {
      title?: string;
      canonical_url?: string;
      last_updated?: string | null;
      text?: string;
    };
    by_bedroom: {
      bedrooms: number;
      label?: string;
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
    by_property_type?: { property_type: string; label: string; median_usd?: number; sample_size: number }[];
    furnished_breakdown?: {
      furnished: { count: number; median_usd?: number | null; sample_size: number };
      unfurnished: { count: number; median_usd?: number | null; sample_size: number };
    };
    trend: { period_end?: string; label?: string; median_usd?: number; sample_size: number }[];
    has_trend_history: boolean;
    last_updated?: string | null;
    transparency?: import("@/components/research/research-transparency").ResearchTransparencyData;
  }>("/research/kigali-rental-market/charts", 60);
}
