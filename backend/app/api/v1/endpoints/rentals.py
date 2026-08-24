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
    match_verified_properties,
    related_intents,
    score_property,
)

router = APIRouter(tags=["Rentals & Research"])

SITE = "https://kigalirent.com"
METHODOLOGY = (
    "Verified matches are KigaliRent-reviewed listings. "
    "Market observation statistics, when shown, come from external listings we observed or imported "
    "and are labeled separately. Disappeared external listings are never assumed rented."
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
async def rentals_sitemap(db: AsyncSession = Depends(get_db)):
    from app.models import SitemapStatus

    result = await db.execute(
        select(SearchIntent).where(
            SearchIntent.is_enabled == True,  # noqa: E712
            SearchIntent.index_status == SearchIndexStatus.INDEXABLE.value,
            SearchIntent.sitemap_status == SitemapStatus.INCLUDED.value,
            SearchIntent.path.is_not(None),
            SearchIntent.path != "",
        )
    )
    items = result.scalars().all()
    from app.services.rental_locations import build_rental_directory

    directory = await build_rental_directory(db)
    hub_items = [
        {"path": "/rentals", "last_built_at": None, "title": "Kigali Rentals Directory"},
        {"path": "/rentals/kigali", "last_built_at": None, "title": "Kigali Rental Market Overview"},
    ]
    for n in directory.get("neighborhoods", []):
        if n.get("listing_count", 0) > 0:
            hub_items.append(
                {"path": n["path"], "last_built_at": None, "title": f"Rentals in {n['name']}"}
            )
    intent_items = [
            {
                "path": i.path,
                "last_built_at": i.last_built_at,
                "title": i.title,
            }
            for i in items
            if i.path.startswith("/rentals/") and i.path.count("/") >= 3
        ]
    return {"items": hub_items + intent_items}


@router.get("/rentals/{location_slug}/{intent_slug}", response_model=SearchLandingPageResponse)
async def get_rental_landing(
    location_slug: str,
    intent_slug: str,
    db: AsyncSession = Depends(get_db),
):
    from app.services.intent_automation import count_observations
    from app.services.landing_pages import (
        build_data_insights,
        generate_intro_text,
        key_attributes_from_query,
        trend_series_for_location,
    )
    from app.services.rental_locations import _snap_dict, _snapshots_by_bedroom
    from app.models import MarketDataKind

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
    matches = await match_verified_properties(db, query, limit=24)
    matches_sorted = sorted(matches, key=lambda p: score_property(p, query), reverse=True)
    obs_count = await count_observations(db, query)

    loc_slug = intent.location_slug
    bedrooms = query.get("bedrooms")
    ptype = query.get("property_type")
    verified_snap_obj = await get_market_snapshot_for_query(db, query)
    # Prefer verified snapshot; also fetch location-level verified + external
    from sqlalchemy import or_

    async def _snap_for_kind(kind: str):
        from app.models import MarketStatSnapshot

        q = (
            select(MarketStatSnapshot)
            .where(
                MarketStatSnapshot.location_slug == loc_slug,
                MarketStatSnapshot.data_kind == kind,
                MarketStatSnapshot.sample_size >= 3,
            )
            .order_by(MarketStatSnapshot.period_end.desc())
        )
        if bedrooms is not None:
            q = q.where(or_(MarketStatSnapshot.bedrooms == int(bedrooms), MarketStatSnapshot.bedrooms.is_(None)))
        if ptype:
            q = q.where(or_(MarketStatSnapshot.property_type == str(ptype).lower(), MarketStatSnapshot.property_type.is_(None)))
        else:
            q = q.where(MarketStatSnapshot.bedrooms.is_(None), MarketStatSnapshot.property_type.is_(None))
        return (await db.execute(q.limit(1))).scalar_one_or_none()

    verified_row = verified_snap_obj or await _snap_for_kind(MarketDataKind.VERIFIED_KIGALI_RENT.value)
    observed_row = await _snap_for_kind(MarketDataKind.MARKET_OBSERVATION.value)

    verified_market = _snap_dict(verified_row, "KigaliRent Verified")
    observation_market = _snap_dict(observed_row, "External Market Observations")
    by_bed_verified = await _snapshots_by_bedroom(db, loc_slug, MarketDataKind.VERIFIED_KIGALI_RENT.value)
    by_bed_external = await _snapshots_by_bedroom(db, loc_slug, MarketDataKind.MARKET_OBSERVATION.value)
    furnished = {
        "furnished": sum(1 for p in matches_sorted if p.is_furnished),
        "unfurnished": sum(1 for p in matches_sorted if not p.is_furnished),
        "total": len(matches_sorted),
    }

    trend_verified = await trend_series_for_location(
        db,
        location_slug=loc_slug,
        data_kind=MarketDataKind.VERIFIED_KIGALI_RENT.value,
        bedrooms=int(bedrooms) if bedrooms is not None else None,
        property_type=str(ptype).lower() if ptype else None,
    )
    trend_external = await trend_series_for_location(
        db,
        location_slug=loc_slug,
        data_kind=MarketDataKind.MARKET_OBSERVATION.value,
        bedrooms=int(bedrooms) if bedrooms is not None else None,
        property_type=str(ptype).lower() if ptype else None,
    )

    location_name = loc_slug.replace("-", " ").title() if loc_slug != "kigali" else "Kigali"
    intro_text = generate_intro_text(
        query,
        match_count=len(matches_sorted),
        observation_count=obs_count,
        verified_snap=verified_market,
        observation_snap=observation_market,
        location_name=location_name,
    )
    insights = build_data_insights(
        match_count=len(matches_sorted),
        observation_count=obs_count,
        verified_snap=verified_market,
        observation_snap=observation_market,
        furnished=furnished,
        by_bedroom_verified=by_bed_verified,
        by_bedroom_external=by_bed_external,
    )

    related = await related_intents(db, intent)
    related_neighborhoods: list[dict] = []
    if loc_slug == "kigali":
        from app.services.rental_locations import _neighborhoods_with_counts

        hoods = await _neighborhoods_with_counts(db)
        related_neighborhoods = [
            {"slug": n["slug"], "name": n["name"], "path": n["path"], "listing_count": n["listing_count"]}
            for n in sorted(hoods, key=lambda x: -x["listing_count"])[:8]
            if n["listing_count"] > 0
        ]
    elif loc_slug:
        from app.services.rental_locations import _neighborhoods_with_counts

        hoods = await _neighborhoods_with_counts(db)
        related_neighborhoods = [
            {"slug": n["slug"], "name": n["name"], "path": n["path"], "listing_count": n["listing_count"]}
            for n in sorted(hoods, key=lambda x: -x["listing_count"])[:6]
            if n["slug"] != loc_slug and n["listing_count"] > 0
        ]

    robots = "index,follow" if intent.index_status == SearchIndexStatus.INDEXABLE.value else "noindex,follow"
    primary_snap = verified_market or observation_market
    return SearchLandingPageResponse(
        path=intent.path or path,
        location_slug=intent.location_slug,
        intent_slug=intent.intent_slug,
        title=intent.title,
        h1=intent.h1,
        meta_description=intent.meta_description,
        intro_html=intent.intro_html,
        intro=intro_text,
        answer=answer_sentence(intent, matches_sorted),
        index_status=intent.index_status,
        robots=robots,
        canonical=f"{SITE}{intent.path}",
        quality_score=intent.quality_score,
        match_count=len(matches_sorted),
        observation_count=obs_count,
        last_updated=intent.last_built_at or intent.updated_at,
        verified_matches=[_card(p, query) for p in matches_sorted],
        market_snapshot=_snap_public(verified_row or observed_row, "Market snapshot") if primary_snap else None,
        verified_market=_snap_public(verified_row, "KigaliRent Verified") if verified_market else None,
        observation_market=_snap_public(observed_row, "External Market Observations") if observation_market else None,
        key_attributes=key_attributes_from_query(query),
        data_insights=insights,
        by_bedroom_verified=by_bed_verified,
        by_bedroom_external=by_bed_external,
        furnished_breakdown=furnished if furnished.get("total", 0) > 0 else None,
        trend_verified=trend_verified,
        trend_external=trend_external,
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
    )


@router.get("/research/kigali-rental-market/meta")
async def research_meta(
    page_title: str = Query("Kigali Rental Market Research"),
    canonical_url: str = Query("https://kigalirent.com/research/kigali-rental-market"),
    db: AsyncSession = Depends(get_db),
):
    from app.services.research_meta import research_transparency

    return await research_transparency(db, page_title=page_title, canonical_url=canonical_url)


@router.get("/research/kigali-rental-market", response_model=ResearchOverviewResponse)
async def research_overview(db: AsyncSession = Depends(get_db)):
    from app.services.research_meta import combined_research_counts, combined_summary_line

    counts = await combined_research_counts(db)
    verified = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.data_kind == MarketDataKind.VERIFIED_KIGALI_RENT.value,
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.property_type.is_(None),
        )
        .order_by(MarketStatSnapshot.period_end.desc())
        .limit(6)
    )
    observed = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.data_kind == MarketDataKind.MARKET_OBSERVATION.value,
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.property_type.is_(None),
        )
        .order_by(MarketStatSnapshot.period_end.desc())
        .limit(6)
    )
    neighborhoods = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.data_kind == MarketDataKind.VERIFIED_KIGALI_RENT.value,
            MarketStatSnapshot.location_slug != "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.sample_size >= 3,
        )
        .order_by(MarketStatSnapshot.median_usd.desc())
        .limit(20)
    )
    v_list = list(verified.scalars().all())
    o_list = list(observed.scalars().all())
    n_list = list(neighborhoods.scalars().all())
    activity = await observation_activity_series(db)
    last = v_list[0].period_end if v_list else (o_list[0].period_end if o_list else None)
    summary = combined_summary_line(
        verified_count=counts["verified_count"],
        external_count=counts["external_count"],
    )
    if v_list and v_list[0].median_usd:
        summary += f" Verified listings in our sample typically ask around ${v_list[0].median_usd:,.0f}/month."
    return ResearchOverviewResponse(
        title="Kigali Rental Market Research",
        summary=summary,
        last_updated=last,
        verified_snapshots=[_snap_public(s, "Verified inventory") for s in v_list if s],
        observation_snapshots=[_snap_public(s, "Market observations") for s in o_list if s],
        activity_series=activity,
        neighborhoods=[_snap_public(s, s.location_name or s.location_slug) for s in n_list if s],
    )


@router.get("/research/kigali-rental-market/prices")
async def research_prices(
    location_slug: str = Query("kigali"),
    bedrooms: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(MarketStatSnapshot)
        .where(MarketStatSnapshot.location_slug == location_slug.lower())
        .order_by(MarketStatSnapshot.period_end.desc())
        .limit(24)
    )
    if bedrooms is not None:
        q = q.where(MarketStatSnapshot.bedrooms == bedrooms)
    result = await db.execute(q)
    rows = list(result.scalars().all())
    return {
        "location_slug": location_slug,
        "bedrooms": bedrooms,
        "items": [_snap_public(s, s.data_kind) for s in rows],
        "note": "Statistics require sufficient sample size and are labeled by data source.",
    }


@router.get("/research/kigali-rental-market/neighborhoods")
async def research_neighborhoods(db: AsyncSession = Depends(get_db)):
    async def _items(kind: str, min_sample: int) -> list:
        result = await db.execute(
            select(MarketStatSnapshot)
            .where(
                MarketStatSnapshot.data_kind == kind,
                MarketStatSnapshot.location_slug != "kigali",
                MarketStatSnapshot.bedrooms.is_(None),
                MarketStatSnapshot.property_type.is_(None),
                MarketStatSnapshot.sample_size >= min_sample,
            )
            .order_by(MarketStatSnapshot.period_end.desc(), MarketStatSnapshot.median_usd.desc())
            .limit(50)
        )
        seen: set[str] = set()
        out = []
        for s in result.scalars().all():
            if s.location_slug in seen:
                continue
            seen.add(s.location_slug)
            out.append(_snap_public(s, s.location_name or s.location_slug))
        return out

    verified = await _items(MarketDataKind.VERIFIED_KIGALI_RENT.value, 3)
    external = await _items(MarketDataKind.MARKET_OBSERVATION.value, 3)
    return {"verified": verified, "external": external, "items": verified}


@router.get("/research/kigali-rental-market/trends")
async def research_trends(db: AsyncSession = Depends(get_db)):
    verified_result = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.data_kind == MarketDataKind.VERIFIED_KIGALI_RENT.value,
        )
        .order_by(MarketStatSnapshot.period_end.asc())
        .limit(36)
    )
    external_result = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.data_kind == MarketDataKind.MARKET_OBSERVATION.value,
        )
        .order_by(MarketStatSnapshot.period_end.asc())
        .limit(36)
    )
    rows = list(verified_result.scalars().all())
    ext_rows = list(external_result.scalars().all())
    series = [
        {
            "period_end": r.period_end.isoformat(),
            "median_usd": r.median_usd,
            "sample_size": r.sample_size,
            "data_kind": r.data_kind,
        }
        for r in rows
    ]
    external_series = [
        {
            "period_end": r.period_end.isoformat(),
            "median_usd": r.median_usd,
            "sample_size": r.sample_size,
            "data_kind": r.data_kind,
        }
        for r in ext_rows
    ]
    activity = await observation_activity_series(db)
    from app.services.research_meta import combined_research_counts, combined_summary_line

    counts = await combined_research_counts(db)
    return {
        "median_series": series,
        "external_median_series": external_series,
        "has_external_trend_history": len(external_series) >= 2,
        "observation_activity": activity,
        "disclaimer": "Observed listing activity is not total market supply. External observations are not verified vacancies.",
        "summary": combined_summary_line(
            verified_count=counts["verified_count"],
            external_count=counts["external_count"],
        ),
        "verified_label": "KigaliRent Verified",
        "external_label": "External Market Observations",
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
        "title": "Methodology & Data Sources",
        "body": METHODOLOGY,
        "rules": [
            "USD is the primary public currency; RWF may be shown for transparency.",
            "Historical observations keep the exchange rate from the observation date.",
            "External listings that disappear are marked not_found — never assumed rented.",
            "Statistics for verified inventory are withheld when sample size is insufficient (minimum 3).",
            "External observation charts update after CSV import; overall external stats appear from the first valid row.",
            "Verified KigaliRent inventory is never mixed with observations without labels.",
            "External Market Observations are public listings observed on external sources; availability is not confirmed.",
            "External data is imported via CSV only — no automated crawling.",
            "Each CSV import receives a public reference (e.g. DATA-0825) without exposing raw files.",
        ],
        "labels": {
            "verified": "KigaliRent Verified",
            "external": "External Market Observations",
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
