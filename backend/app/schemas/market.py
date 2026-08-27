"""Schemas for rental intelligence / search landings / research."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SearchIntentQuery(BaseModel):
    location: Optional[str] = None
    location_slug: Optional[str] = None
    property_type: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    furnished: Optional[bool] = None
    amenities: List[str] = []
    amenity_slugs: List[str] = []
    min_price_usd: Optional[float] = None
    max_price_usd: Optional[float] = None
    currency: str = "USD"


class SearchIntentCreate(BaseModel):
    location_slug: str
    intent_slug: str
    query: dict[str, Any]
    title: str
    h1: str
    meta_description: Optional[str] = None
    intro_html: Optional[str] = None
    index_status: str = "draft"
    is_enabled: bool = True


class SearchIntentUpdate(BaseModel):
    query: Optional[dict[str, Any]] = None
    title: Optional[str] = None
    h1: Optional[str] = None
    meta_description: Optional[str] = None
    intro_html: Optional[str] = None
    index_status: Optional[str] = None
    is_enabled: Optional[bool] = None
    locked_by_admin: Optional[bool] = None
    automation_disabled: Optional[bool] = None
    status_reason: Optional[str] = None


class SearchIntentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    location_slug: str
    intent_slug: str
    path: str
    query: dict[str, Any]
    title: str
    h1: str
    meta_description: Optional[str] = None
    quality_score: float
    opportunity_score: float = 0
    index_status: str
    sitemap_status: str = "excluded"
    seo_control: str = "automatic"
    automatic_eligibility: str = "excluded"
    match_count: int
    matching_observation_count: int = 0
    last_built_at: Optional[datetime] = None
    last_calculated_at: Optional[datetime] = None
    last_evaluated_at: Optional[datetime] = None
    last_content_change_at: Optional[datetime] = None
    data_freshness: str = "unknown"
    status_reason: Optional[str] = None
    source: str = "manual"
    locked_by_admin: bool = False
    automation_disabled: bool = False
    gsc_impressions: Optional[int] = None
    gsc_clicks: Optional[int] = None
    gsc_ctr: Optional[float] = None
    gsc_position: Optional[float] = None
    is_enabled: bool
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    filter_count: Optional[int] = None
    filters_label: Optional[str] = None
    filters: Optional[List[str]] = None
    intent_score: Optional[float] = None
    intent_strength: Optional[str] = None
    intent_strength_tier: Optional[int] = None


class SearchIntentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[SearchIntentListItem]


class EligibilityCheckItem(BaseModel):
    label: str
    passed: bool
    detail: str


class SearchIntentEligibilityDetails(BaseModel):
    eligible: bool
    summary: str
    checks: List[EligibilityCheckItem]
    dimensions: int
    filter_count: Optional[int] = None
    index_status: str
    sitemap_status: str
    seo_control: str
    automatic_eligibility: str
    status_reason: Optional[str] = None
    last_evaluated_at: Optional[datetime] = None


class ScoredPropertyCard(BaseModel):
    id: UUID
    title: str
    slug: str
    price: float
    usd_price: Optional[float] = None
    currency: str
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    is_furnished: bool = False
    has_pool: bool = False
    has_parking: bool = False
    neighborhood_name: Optional[str] = None
    property_type_name: Optional[str] = None
    primary_image: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    data_source_kind: str = "verified_kigali_rent"
    status: str
    relevance_score: float


class MarketSnapshotPublic(BaseModel):
    data_kind: str
    sample_size: int
    median_usd: Optional[float] = None
    p25_usd: Optional[float] = None
    p75_usd: Optional[float] = None
    min_usd: Optional[float] = None
    max_usd: Optional[float] = None
    period_end: Optional[date] = None
    common_amenities: Optional[List[str]] = None
    summary: str
    label: str = "Market snapshot"


class RelatedIntentLink(BaseModel):
    path: str
    title: str
    h1: str
    location_slug: str
    intent_slug: str


class TrendPoint(BaseModel):
    label: str
    median_usd: Optional[float] = None
    sample_size: int = 0
    period_end: Optional[str] = None


class SearchLandingPageResponse(BaseModel):
    path: str
    location_slug: str
    intent_slug: str
    title: str
    h1: str
    meta_description: Optional[str] = None
    intro_html: Optional[str] = None
    intro: Optional[str] = None
    answer: str
    index_status: str
    robots: str
    canonical: str
    quality_score: float
    match_count: int
    observation_count: int = 0
    last_updated: Optional[datetime] = None
    verified_matches: List[ScoredPropertyCard]
    market_snapshot: Optional[MarketSnapshotPublic] = None
    verified_market: Optional[MarketSnapshotPublic] = None
    observation_market: Optional[MarketSnapshotPublic] = None
    key_attributes: List[str] = []
    data_insights: List[str] = []
    by_bedroom_verified: List[dict[str, Any]] = []
    by_bedroom_external: List[dict[str, Any]] = []
    furnished_breakdown: Optional[dict[str, Any]] = None
    trend_verified: List[TrendPoint] = []
    trend_external: List[TrendPoint] = []
    related: List[RelatedIntentLink] = []
    related_neighborhoods: List[dict[str, Any]] = []
    methodology_note: str
    market_answer: Optional[dict[str, Any]] = None
    alert_context: Optional[dict[str, Any]] = None
    listing_cap: int = 9
    listing_cap_mobile: int = 6


class ResearchOverviewResponse(BaseModel):
    title: str
    summary: str
    last_updated: Optional[date] = None
    verified_snapshots: List[MarketSnapshotPublic]
    observation_snapshots: List[MarketSnapshotPublic]
    activity_series: List[dict[str, Any]]
    neighborhoods: List[MarketSnapshotPublic]


class GscSuggestionCreate(BaseModel):
    query: str
    impressions: Optional[int] = None
    clicks: Optional[int] = None
    ctr: Optional[float] = None
    position: Optional[float] = None
    suggested_path: Optional[str] = None
    notes: Optional[str] = None


class GscSuggestionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    query: str
    impressions: Optional[int] = None
    clicks: Optional[int] = None
    ctr: Optional[float] = None
    position: Optional[float] = None
    status: str
    suggested_path: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class ObservationImportResult(BaseModel):
    imported: int
    skipped: int
    errors: List[str] = []
