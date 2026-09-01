"""Public rental search landing pages + research APIs."""

from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.models import ExternalMarketSource, MarketDataKind, MarketStatSnapshot, SearchIndexStatus, SearchIntent
from app.schemas.market import (
    MarketSnapshotPublic,
    RelatedIntentLink,
    ResearchOverviewResponse,
    ScoredPropertyCard,
    SearchLandingPageResponse,
)
from app.services.fx import effective_usd_price
from app.services.research import observation_activity_series, textual_summary
from app.services.search_intent import (
    answer_sentence,
    get_market_snapshot_for_query,
    related_intents,
    score_property,
)

router = APIRouter(tags=["Rentals & Research"])

SITE = "https://kigalirent.com"
METHODOLOGY = (
    "Market data combines eligible KigaliRent Verified listings and approved external market "
    "observations after normalization, deduplication, and outlier screening. "
    "Figures are asking rents, not confirmed lease prices. "
    "Available verified rentals below are current KigaliRent inventory and are shown separately. "
    "Disappeared external listings are never assumed rented."
)


def _card(prop, query: dict) -> ScoredPropertyCard:
    primary = next((img.url for img in prop.images if img.is_primary), None)
    if not primary and prop.images:
        primary = prop.images[0].url
    return ScoredPropertyCard(
        id=prop.id,
        title=prop.title,
        slug=prop.slug,
        price=prop.price,
        usd_price=effective_usd_price(prop),
        currency=prop.currency,
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        is_furnished=prop.is_furnished,
        has_pool=prop.has_pool,
        has_parking=prop.has_parking,
        neighborhood_name=prop.neighborhood.name if prop.neighborhood else None,
        property_type_name=prop.property_type.name if prop.property_type else None,
        primary_image=primary,
        last_verified_at=prop.last_verified_at,
        data_source_kind=prop.data_source_kind or "verified_kigali_rent",
        status=prop.status.value if hasattr(prop.status, "value") else str(prop.status),
        relevance_score=score_property(prop, query),
    )


def _snap_public(snap: MarketStatSnapshot | None, label: str) -> MarketSnapshotPublic | None:
    if not snap:
        return None
    return MarketSnapshotPublic(
        data_kind=snap.data_kind,
        sample_size=snap.sample_size,
        median_usd=snap.median_usd,
        p25_usd=snap.p25_usd,
        p75_usd=snap.p75_usd,
        min_usd=snap.min_usd,
        max_usd=snap.max_usd,
        period_end=snap.period_end,
        common_amenities=snap.common_amenities,
        summary=textual_summary(snap, label),
        label=label,
    )


@router.get("/rentals/directory")
async def rental_directory(db: AsyncSession = Depends(get_db)):
    from app.services.rental_locations import build_rental_directory

    return await build_rental_directory(db)


@router.get("/rentals/locations/{location_slug}")
async def rental_location_page(location_slug: str, db: AsyncSession = Depends(get_db)):
    from app.services.rental_locations import build_location_page

    page = await build_location_page(db, location_slug)
    if not page:
        raise HTTPException(status_code=404, detail="Rental location not found")
    return page


@router.get("/rentals/sitemap")
async def rentals_sitemap(
    debug: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Sitemap entries for /sitemap-rentals.xml — lightweight, production DB state only.

    Includes:
    - hub pages (/rentals, /rentals/kigali, neighborhood hubs with listings)
    - search intents that are enabled + indexable + sitemap included
    """
    from sqlalchemy import func

    from app.models import ListingType, Neighborhood, Property, PropertyStatusEnum, SitemapStatus

    # Fast hub list: neighborhoods that currently have published rentals
    hood_rows = await db.execute(
        select(Neighborhood.slug, Neighborhood.name, func.count(Property.id))
        .outerjoin(
            Property,
            (Property.neighborhood_id == Neighborhood.id)
            & (Property.status == PropertyStatusEnum.PUBLISHED)
            & (Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED])),
        )
        .where(Neighborhood.is_active == True)  # noqa: E712
        .group_by(Neighborhood.slug, Neighborhood.name)
        .order_by(Neighborhood.name.asc())
    )
    hub_items: list[dict] = []
    for slug, name, count in hood_rows.all():
        slug_s = str(slug or "").strip().strip("/").lower()
        if not slug_s or int(count or 0) <= 0:
            continue
        # /rentals and /rentals/kigali belong in sitemap-pages.xml — omit here
        if slug_s == "kigali":
            continue
        hub_items.append(
            {"path": f"/rentals/{slug_s}", "last_built_at": None, "title": f"Rentals in {name}"}
        )

    result = await db.execute(
        select(SearchIntent).where(
            SearchIntent.is_enabled == True,  # noqa: E712
            SearchIntent.index_status == SearchIndexStatus.INDEXABLE.value,
            SearchIntent.sitemap_status == SitemapStatus.INCLUDED.value,
            SearchIntent.path.is_not(None),
            SearchIntent.path != "",
        )
    )
    intents = list(result.scalars().all())
    intent_items: list[dict] = []
    for i in intents:
        path = str(i.path or "").strip()
        if not path.startswith("/rentals/"):
            continue
        # /rentals/{location}/{intent} — at least 3 segments
        if path.count("/") < 3:
            continue
        # Skip records with empty location/intent segments
        parts = [p for p in path.split("/") if p]
        if len(parts) < 3 or any(not p.strip() for p in parts):
            continue
        last_built = i.last_built_at.isoformat() if getattr(i, "last_built_at", None) else None
        intent_items.append(
            {
                "path": path,
                "last_built_at": last_built,
                "title": i.title or path,
                "_intent": i,
            }
        )

    from app.services.intent_config import load_automation_config
    from app.services.seo_landing import sitemap_priority_key

    cfg = await load_automation_config(db)
    max_urls = int(cfg.max_sitemap_urls or 100)
    intent_items.sort(key=lambda row: sitemap_priority_key(row["_intent"]), reverse=True)
    # Keep eligible included intents, but never exceed the configured hard cap
    intent_items = intent_items[:max_urls]
    for row in intent_items:
        row.pop("_intent", None)

    items = hub_items + intent_items
    payload: dict = {
        "items": items,
        "count": len(items),
        "hub_count": len(hub_items),
        "intent_count": len(intent_items),
        "max_sitemap_urls": max_urls,
    }
    if debug:
        payload["diagnostics"] = {
            "filters": {
                "is_enabled": True,
                "index_status": SearchIndexStatus.INDEXABLE.value,
                "sitemap_status": SitemapStatus.INCLUDED.value,
                "path_prefix": "/rentals/",
                "min_path_segments": 3,
            },
            "table": "search_intents",
            "max_sitemap_urls": max_urls,
            "intent_paths_sample": [i["path"] for i in intent_items[:15]],
            "indexable_total": int(
                (
                    await db.execute(
                        select(func.count())
                        .select_from(SearchIntent)
                        .where(SearchIntent.index_status == SearchIndexStatus.INDEXABLE.value)
                    )
                ).scalar()
                or 0
            ),
            "sitemap_included_total": int(
                (
                    await db.execute(
                        select(func.count())
                        .select_from(SearchIntent)
                        .where(SearchIntent.sitemap_status == SitemapStatus.INCLUDED.value)
                    )
                ).scalar()
                or 0
            ),
            "eligible_intent_total": len(intent_items),
        }
    return payload


@router.get("/rentals/{location_slug}/{intent_slug}", response_model=SearchLandingPageResponse)
async def get_rental_landing(
    location_slug: str,
    intent_slug: str,
    db: AsyncSession = Depends(get_db),
):
    from app.services.combined_market import combined_slice_context
    from app.services.landing_pages import (
        build_data_insights,
        generate_display_description,
        key_attributes_from_query,
    )
    from app.services.search_intent import match_rentals_for_hub, match_verified_properties

    path = f"/rentals/{location_slug.lower()}/{intent_slug.lower()}"
    result = await db.execute(
        select(SearchIntent).where(
            SearchIntent.location_slug == location_slug.lower(),
            SearchIntent.intent_slug == intent_slug.lower(),
            SearchIntent.is_enabled == True,  # noqa: E712
        )
    )
    intent = result.scalar_one_or_none()
    if not intent or intent.index_status == SearchIndexStatus.DISABLED.value:
        raise HTTPException(status_code=404, detail="Search page not found")

    query = intent.query or {}
    from app.services.rental_locations import RENTAL_HUB_LISTING_CAP

    related = await related_intents(db, intent)
    related_searches = [
        {
            "path": r.path,
            "title": r.title,
            "h1": r.h1,
            "match_count": r.match_count,
            "query": r.query or {},
        }
        for r in related
    ]
    # Page intent keywords dominate; related rental searches refine ranking among matches.
    ranking_searches = [
        {
            "path": intent.path,
            "title": intent.title,
            "h1": intent.h1,
            "match_count": max(int(intent.match_count or 0), 25),
            "query": query,
        },
        *related_searches,
    ]
    exact_matches = await match_verified_properties(
        db,
        query,
        limit=RENTAL_HUB_LISTING_CAP,
        allow_closest=False,
    )
    if exact_matches:
        matches = exact_matches
        match_mode = "exact"
    else:
        matches, match_mode = await match_rentals_for_hub(
            db,
            query,
            limit=RENTAL_HUB_LISTING_CAP,
            related_searches=ranking_searches,
        )
    match_count = int(intent.match_count or 0) or len(matches)

    loc_slug = intent.location_slug
    bedrooms = query.get("bedrooms")
    ptype = query.get("property_type")
    furnished_flag = query.get("furnished") if isinstance(query.get("furnished"), bool) else None

    market_ctx = await combined_slice_context(
        db,
        location_slug=loc_slug,
        bedrooms=int(bedrooms) if bedrooms is not None else None,
        property_type=str(ptype).lower() if ptype else None,
        furnished=furnished_flag,
    )
    market_answer = market_ctx["market_answer"]
    by_bed = market_ctx.get("by_bedroom") or []
    trend = market_ctx.get("trend") or []
    furnished_market = market_ctx.get("furnished_breakdown")

    location_name = loc_slug.replace("-", " ").title() if loc_slug != "kigali" else "Kigali"
    intro_text = generate_display_description(query, location_name=location_name)
    insights = build_data_insights(
        match_count=match_count,
        market_insights=market_ctx.get("data_insights") or [],
    )

    related_neighborhoods: list[dict] = []
    from app.services.rental_locations import _neighborhoods_with_counts

    hoods = await _neighborhoods_with_counts(db)
    if loc_slug == "kigali":
        related_neighborhoods = [
            {"slug": n["slug"], "name": n["name"], "path": n["path"], "listing_count": n["listing_count"]}
            for n in sorted(hoods, key=lambda x: -x["listing_count"])[:8]
            if n["listing_count"] > 0
        ]
    elif loc_slug:
        # Prefer market neighbourhoods with enough combined data, then inventory
        market_hoods = {
            n.get("location_slug"): n for n in (market_ctx.get("by_neighborhood") or []) if n.get("location_slug")
        }
        related_neighborhoods = [
            {
                "slug": n["slug"],
                "name": n["name"],
                "path": n["path"],
                "listing_count": n["listing_count"],
                "median_usd": (market_hoods.get(n["slug"]) or {}).get("median_usd"),
            }
            for n in sorted(hoods, key=lambda x: -x["listing_count"])[:6]
            if n["slug"] != loc_slug and n["listing_count"] > 0
        ]

    robots = "index,follow" if intent.index_status == SearchIndexStatus.INDEXABLE.value else "noindex,follow"
    furnished_payload = None
    if furnished_market and (
        (furnished_market.get("furnished") or {}).get("sample_size", 0) >= 5
        or (furnished_market.get("unfurnished") or {}).get("sample_size", 0) >= 5
    ):
        furnished_payload = {
            "furnished": (furnished_market.get("furnished") or {}).get("sample_size", 0),
            "unfurnished": (furnished_market.get("unfurnished") or {}).get("sample_size", 0),
            "total": (
                (furnished_market.get("furnished") or {}).get("sample_size", 0)
                + (furnished_market.get("unfurnished") or {}).get("sample_size", 0)
            ),
            "furnished_median_usd": (furnished_market.get("furnished") or {}).get("median_usd"),
            "unfurnished_median_usd": (furnished_market.get("unfurnished") or {}).get("median_usd"),
        }

    area_label = location_name
    budget_label = None
    if query.get("max_price_usd") is not None:
        budget_label = f"up to ${float(query['max_price_usd']):,.0f}"
    elif query.get("max_price") is not None:
        budget_label = f"up to ${float(query['max_price']):,.0f}"
    beds_label = str(query["bedrooms"]) if query.get("bedrooms") is not None else None
    alert_context = {
        "intent": "rent",
        "area": area_label,
        "bedrooms": beds_label,
        "budget": budget_label,
        "property_type": query.get("property_type") or query.get("property_type_slug"),
        "furnished": query.get("furnished"),
        "search_label": intent.h1,
        "search_url": f"{SITE}{intent.path or path}",
    }

    return SearchLandingPageResponse(
        path=intent.path or path,
        location_slug=intent.location_slug,
        intent_slug=intent.intent_slug,
        title=intent.title,
        h1=intent.h1,
        meta_description=intent.meta_description,
        intro_html=intent.intro_html,
        intro=intro_text,
        answer=answer_sentence(intent, matches, total_count=match_count, match_mode=match_mode),
        index_status=intent.index_status,
        robots=robots,
        canonical=f"{SITE}{intent.path}",
        quality_score=intent.quality_score,
        match_count=match_count,
        observation_count=market_answer.get("sample_size") or 0,
        last_updated=intent.last_built_at or intent.updated_at,
        verified_matches=[_card(p, query) for p in matches],
        market_snapshot=None,
        verified_market=None,
        observation_market=None,
        key_attributes=key_attributes_from_query(query),
        data_insights=insights,
        by_bedroom_verified=by_bed,
        by_bedroom_external=[],
        furnished_breakdown=furnished_payload,
        trend_verified=trend,
        trend_external=[],
        related=[
            RelatedIntentLink(
                path=r.path,
                title=r.title,
                h1=r.h1,
                location_slug=r.location_slug,
                intent_slug=r.intent_slug,
            )
            for r in related
        ],
        related_neighborhoods=related_neighborhoods,
        methodology_note=METHODOLOGY,
        market_answer=market_answer,
        alert_context=alert_context,
        listing_cap=RENTAL_HUB_LISTING_CAP,
        listing_cap_mobile=6,
        match_mode=match_mode,
    )


@router.get("/research/kigali-rental-market/meta")
async def research_meta(
    page_title: str = Query("Kigali Rental Market Research"),
    canonical_url: str = Query("https://kigalirent.com/research/kigali-rental-market"),
    db: AsyncSession = Depends(get_db),
):
    from app.services.research_meta import research_transparency

    return await research_transparency(db, page_title=page_title, canonical_url=canonical_url)


@router.get("/research/kigali-rental-market/answer")
async def research_market_answer(
    location_slug: str = Query("kigali"),
    bedrooms: Optional[int] = None,
    property_type: Optional[str] = None,
    furnished: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    from app.services.combined_market import combined_market_answer

    return await combined_market_answer(
        db,
        location_slug=location_slug,
        bedrooms=bedrooms,
        property_type=property_type,
        furnished=furnished,
    )


@router.get("/research/kigali-rental-market", response_model=ResearchOverviewResponse)
async def research_overview(db: AsyncSession = Depends(get_db)):
    from app.services.combined_market import combined_research_payload
    from app.services.research_meta import combined_research_counts

    counts = await combined_research_counts(db)
    combined = await combined_research_payload(db)
    primary = combined.get("primary_answer") or {}
    activity = await observation_activity_series(db)

    # Lightweight neighborhood list from combined payload for overview schema compatibility
    neighborhood_snaps = []
    for n in combined.get("by_neighborhood") or []:
        neighborhood_snaps.append(
            MarketSnapshotPublic(
                data_kind="combined",
                sample_size=n.get("sample_size") or 0,
                median_usd=n.get("median_usd"),
                p25_usd=n.get("p25_usd"),
                p75_usd=n.get("p75_usd"),
                period_end=None,
                common_amenities=None,
                summary=f"{n.get('label')}: typical asking rent ${n.get('median_usd'):,.0f}/month" if n.get("median_usd") else n.get("label") or "",
                label=n.get("label") or n.get("location_slug") or "",
            )
        )

    overall = MarketSnapshotPublic(
        data_kind="combined",
        sample_size=primary.get("sample_size") or 0,
        median_usd=(primary.get("stats") or {}).get("median_usd"),
        p25_usd=(primary.get("stats") or {}).get("p25_usd"),
        p75_usd=(primary.get("stats") or {}).get("p75_usd"),
        period_end=None,
        common_amenities=None,
        summary=primary.get("summary") or "",
        label="Kigali rental market",
    ) if primary.get("has_enough_data") else None

    return ResearchOverviewResponse(
        title=combined.get("title") or "Kigali Rental Market Data & Research",
        summary=primary.get("summary")
        or f"Based on {counts['total_count']} observed rental listings in Kigali (asking rents).",
        last_updated=None,
        verified_snapshots=[overall] if overall else [],
        observation_snapshots=[],
        activity_series=activity,
        neighborhoods=neighborhood_snaps[:20],
    )


@router.get("/research/kigali-rental-market/prices")
async def research_prices(
    location_slug: str = Query("kigali"),
    bedrooms: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    from app.services.combined_market import combined_research_payload, combined_slice_context

    ctx = await combined_slice_context(
        db,
        location_slug=location_slug,
        bedrooms=bedrooms,
    )
    answer = ctx["market_answer"]
    # Full city comparisons when viewing overall Kigali prices
    if bedrooms is None and location_slug.lower() in {"kigali", "all"}:
        hub = await combined_research_payload(db)
        return {
            "location_slug": location_slug,
            "bedrooms": bedrooms,
            "answer": hub.get("primary_answer") or answer,
            "bedroom_answers": hub.get("bedroom_answers") or [],
            "property_type_answers": hub.get("property_type_answers") or [],
            "items": [
                {
                    "data_kind": "combined",
                    "sample_size": b.get("sample_size"),
                    "median_usd": b.get("median_usd"),
                    "p25_usd": b.get("p25_usd"),
                    "p75_usd": b.get("p75_usd"),
                    "period_end": b.get("period_end"),
                    "summary": f"Typical asking rent: ${b['median_usd']:,.0f}/month" if b.get("median_usd") is not None else "Not enough data",
                    "label": f"{b.get('label')}-bedroom" if str(b.get("label")).isdigit() or b.get("label") == "4+" else b.get("label"),
                    "bedrooms": b.get("bedrooms"),
                }
                for b in (hub.get("by_bedroom") or [])
            ],
            "by_bedroom": hub.get("by_bedroom") or [],
            "by_property_type": hub.get("by_property_type") or [],
            "by_neighborhood": hub.get("by_neighborhood") or [],
            "furnished_breakdown": hub.get("furnished_breakdown"),
            "budget_bands": hub.get("budget_bands") or [],
            "trend": hub.get("trend") or [],
            "has_trend_history": hub.get("has_trend_history"),
            "insights": hub.get("insights") or [],
            "sections": hub.get("sections") or {},
            "about": hub.get("about") or {},
            "note": "Combined asking-rent estimates from eligible observations. Not confirmed lease prices.",
        }

    items = []
    if answer.get("has_enough_data") and answer.get("stats"):
        st = answer["stats"]
        items.append(
            {
                "data_kind": "combined",
                "sample_size": st["sample_size"],
                "median_usd": st["median_usd"],
                "p25_usd": st["p25_usd"],
                "p75_usd": st["p75_usd"],
                "period_end": answer.get("period_end"),
                "summary": f"{answer.get('headline')} {answer.get('summary')}",
                "label": "Market estimate",
            }
        )
    return {
        "location_slug": location_slug,
        "bedrooms": bedrooms,
        "answer": answer,
        "items": items,
        "by_bedroom": ctx.get("by_bedroom") or [],
        "by_property_type": ctx.get("by_property_type") or [],
        "by_neighborhood": ctx.get("by_neighborhood") or [],
        "furnished_breakdown": ctx.get("furnished_breakdown"),
        "budget_bands": ctx.get("budget_bands") or [],
        "trend": ctx.get("trend") or [],
        "has_trend_history": ctx.get("has_trend_history"),
        "insights": ctx.get("insights") or [],
        "sections": ctx.get("sections") or {},
        "note": "Combined asking-rent estimates from eligible observations. Not confirmed lease prices.",
    }


@router.get("/research/kigali-rental-market/neighborhoods")
async def research_neighborhoods(db: AsyncSession = Depends(get_db)):
    from app.services.combined_market import combined_research_payload

    combined = await combined_research_payload(db)
    items = [
        MarketSnapshotPublic(
            data_kind="combined",
            sample_size=n.get("sample_size") or 0,
            median_usd=n.get("median_usd"),
            p25_usd=n.get("p25_usd"),
            p75_usd=n.get("p75_usd"),
            period_end=None,
            common_amenities=None,
            summary=(
                f"Typical asking rent ${n['median_usd']:,.0f}/month"
                if n.get("median_usd") is not None
                else "Not enough data"
            ),
            label=n.get("label") or n.get("location_slug") or "",
        )
        for n in (combined.get("by_neighborhood") or [])
    ]
    return {
        "items": items,
        "answer": combined.get("primary_answer"),
        "note": "Neighborhood medians use the same combined asking-rent dataset as the research hub.",
    }


@router.get("/research/kigali-rental-market/trends")
async def research_trends(db: AsyncSession = Depends(get_db)):
    from app.services.combined_market import combined_research_payload

    combined = await combined_research_payload(db)
    trend = combined.get("trend") or []
    series = [
        {
            "period_end": t.get("period_end") or t.get("label"),
            "median_usd": t.get("median_usd"),
            "sample_size": t.get("sample_size"),
            "data_kind": "combined",
        }
        for t in trend
    ]
    activity = await observation_activity_series(db)
    primary = combined.get("primary_answer") or {}
    return {
        "median_series": series,
        "external_median_series": [],
        "has_external_trend_history": False,
        "observation_activity": activity,
        "disclaimer": "Trend lines use combined asking-rent observations. Not confirmed lease prices.",
        "summary": primary.get("summary") or "Combined asking-rent trends for Kigali.",
        "answer": primary,
        "has_trend_history": combined.get("has_trend_history", False),
    }


@router.get("/research/kigali-rental-market/charts")
async def research_charts(db: AsyncSession = Depends(get_db)):
    from app.services.research import research_chart_payload

    return await research_chart_payload(db)


@router.get("/research/kigali-rental-market/methodology")
async def research_methodology(db: AsyncSession = Depends(get_db)):
    from app.services.import_batches import list_public_import_batches
    from app.services.research_meta import research_transparency

    transparency = await research_transparency(db)
    batches = await list_public_import_batches(db, limit=20)
    return {
        "title": "Data sources & methodology",
        "body": (
            "Kigali rental market research combines eligible asking-rent observations into one "
            "defensible market estimate. Verified listings and approved external observations "
            "are kept separate internally for quality control, then normalized, deduplicated, "
            "screened for outliers, and combined for public answers."
        ),
        "rules": [
            "Public research answers show ONE combined market result — not competing rates by source.",
            "USD is the primary public currency.",
            "Eligible asking rents are normalized, deduplicated, and screened for outliers (IQR).",
            "Statistics are withheld when sample size is insufficient.",
            "Figures reflect asking rents, not confirmed lease or sale prices.",
            "External listings that disappear are marked not_found — never assumed rented.",
            "External data is imported via CSV only — raw CSV files are not published.",
            "Each CSV import receives a public reference (e.g. DATA-0825).",
            "Source attribution is available here for transparency; sources are not promoted as competing price feeds.",
        ],
        "labels": {
            "verified": "Verified listings (internal provenance)",
            "external": "External observations (internal provenance)",
            "combined": "Combined Kigali rental market estimate",
        },
        "transparency": transparency,
        "import_batches": batches,
    }


@router.get("/research/kigali-rental-market/sources")
async def research_sources(db: AsyncSession = Depends(get_db)):
    from app.models import RentalObservation
    from app.services.market_sources import ensure_source_rows
    from sqlalchemy import func

    await ensure_source_rows(db)
    result = await db.execute(
        select(RentalObservation.source, func.count())
        .group_by(RentalObservation.source)
        .order_by(func.count().desc())
    )
    raw = {s: c for s, c in result.all()}
    src_rows = list((await db.execute(select(ExternalMarketSource))).scalars().all())
    name_by_key = {r.source_id: r.name for r in src_rows}
    name_by_key.update({r.name: r.name for r in src_rows})
    url_by_key = {r.source_id: r.base_url for r in src_rows}
    url_by_key.update({r.name: r.base_url for r in src_rows})

    sources = []
    for key, count in raw.items():
        display = name_by_key.get(key, key)
        sources.append(
            {
                "source": display,
                "source_key": key,
                "observation_count": count,
                "kind": "market_observation",
                "attribution": f"External market observation — Source: {display}",
                "source_url": url_by_key.get(key),
            }
        )
    sources.sort(key=lambda x: -x["observation_count"])
    from app.services.research_meta import combined_research_counts, combined_summary_line

    counts = await combined_research_counts(db)
    sources.insert(
        0,
        {
            "source": "KigaliRent verified inventory",
            "source_key": "verified",
            "observation_count": None,
            "kind": "verified_kigali_rent",
            "attribution": "KigaliRent Verified — reviewed listings only",
            "source_url": "https://kigalirent.com/properties",
        },
    )
    return {
        "combined_summary": combined_summary_line(
            verified_count=counts["verified_count"],
            external_count=counts["external_count"],
        ),
        "sources": sources,
    }


@router.get("/research/kigali-rental-market/reports")
async def research_reports():
    return {
        "reports": [
            {
                "slug": "overview",
                "title": "Kigali Rental Market Overview",
                "path": "/research/kigali-rental-market",
            },
            {
                "slug": "prices",
                "title": "Rental Prices",
                "path": "/research/kigali-rental-market/prices",
            },
            {
                "slug": "neighborhoods",
                "title": "Neighborhood Comparison",
                "path": "/research/kigali-rental-market/neighborhoods",
            },
            {
                "slug": "trends",
                "title": "Trends",
                "path": "/research/kigali-rental-market/trends",
            },
        ]
    }
