export type MarketSnapshot = {
  data_kind: string;
  sample_size: number;
  median_usd?: number;
  p25_usd?: number;
  p75_usd?: number;
  min_usd?: number;
  max_usd?: number;
  period_end?: string;
  common_amenities?: string[];
  summary: string;
  label: string;
};

export type ScoredPropertyCard = {
  id: string;
  title: string;
  slug: string;
  price: number;
  usd_price?: number;
  currency: string;
  bedrooms?: number;
  bathrooms?: number;
  is_furnished: boolean;
  has_pool: boolean;
  has_parking: boolean;
  neighborhood_name?: string;
  property_type_name?: string;
  primary_image?: string;
  last_verified_at?: string;
  data_source_kind: string;
  status: string;
  relevance_score: number;
};

export type SearchLandingPage = {
  path: string;
  location_slug: string;
  intent_slug: string;
  title: string;
  h1: string;
  meta_description?: string;
  intro_html?: string;
  intro?: string;
  answer: string;
  index_status: string;
  robots: string;
  canonical: string;
  quality_score: number;
  match_count: number;
  observation_count?: number;
  last_updated?: string;
  verified_matches: ScoredPropertyCard[];
  market_snapshot?: MarketSnapshot | null;
  verified_market?: MarketSnapshot | null;
  observation_market?: MarketSnapshot | null;
  key_attributes?: string[];
  data_insights?: string[];
  by_bedroom_verified?: { bedrooms: number; median_usd?: number; p25_usd?: number; p75_usd?: number; sample_size: number }[];
  by_bedroom_external?: { bedrooms: number; median_usd?: number; p25_usd?: number; p75_usd?: number; sample_size: number }[];
  furnished_breakdown?: { furnished: number; unfurnished: number; total: number };
  trend_verified?: { label: string; median_usd?: number; sample_size?: number }[];
  trend_external?: { label: string; median_usd?: number; sample_size?: number }[];
  related: { path: string; title: string; h1: string; location_slug: string; intent_slug: string }[];
  related_neighborhoods?: { slug: string; name: string; path: string; listing_count: number }[];
  methodology_note: string;
};

export type SearchIntentListResponse = {
  total: number;
  page: number;
  page_size: number;
  items: SearchIntentAdmin[];
};

export type EligibilityDetails = {
  eligible: boolean;
  summary: string;
  checks: { label: string; passed: boolean; detail: string }[];
  dimensions: number;
  index_status: string;
  sitemap_status: string;
  seo_control: string;
  automatic_eligibility: string;
  status_reason?: string;
  last_evaluated_at?: string;
};

export type LandingPageStats = {
  total: number;
  eligible: number;
  excluded: number;
  indexable: number;
  noindex: number;
  sitemap_included: number;
  sitemap_excluded: number;
  manual: number;
  automatic: number;
};

export type SearchIntentAdmin = {
  id: string;
  location_slug: string;
  intent_slug: string;
  path: string;
  query: Record<string, unknown>;
  title: string;
  h1: string;
  meta_description?: string;
  quality_score: number;
  opportunity_score?: number;
  index_status: string;
  sitemap_status?: string;
  seo_control?: string;
  automatic_eligibility?: string;
  match_count: number;
  matching_observation_count?: number;
  last_built_at?: string;
  last_calculated_at?: string;
  last_evaluated_at?: string;
  last_content_change_at?: string;
  data_freshness?: string;
  status_reason?: string;
  source?: string;
  locked_by_admin?: boolean;
  automation_disabled?: boolean;
  gsc_impressions?: number;
  gsc_clicks?: number;
  gsc_ctr?: number;
  gsc_position?: number;
  is_enabled: boolean;
  updated_at?: string;
};
