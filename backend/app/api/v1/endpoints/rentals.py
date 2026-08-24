"""Public rental search landing pages + research APIs."""

from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.models import MarketDataKind, MarketStatSnapshot, SearchIndexStatus, SearchIntent
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


@router.get("/rentals/sitemap")
async def rentals_sitemap(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SearchIntent).where(
            SearchIntent.is_enabled == True,  # noqa: E712
            SearchIntent.index_status == SearchIndexStatus.INDEXABLE.value,
        )
    )
    items = result.scalars().all()
    return {
        "items": [
            {
                "path": i.path,
                "last_built_at": i.last_built_at,
                "title": i.title,
            }
            for i in items
        ]
    }


@router.get("/rentals/{location_slug}/{intent_slug}", response_model=SearchLandingPageResponse)
async def get_rental_landing(
    location_slug: str,
    intent_slug: str,
    db: AsyncSession = Depends(get_db),
):
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

    matches = await match_verified_properties(db, intent.query, limit=24)
    matches_sorted = sorted(matches, key=lambda p: score_property(p, intent.query), reverse=True)
    snap = await get_market_snapshot_for_query(db, intent.query)
    related = await related_intents(db, intent)

    robots = "index,follow" if intent.index_status == SearchIndexStatus.INDEXABLE.value else "noindex,follow"
    return SearchLandingPageResponse(
        path=intent.path or path,
        location_slug=intent.location_slug,
        intent_slug=intent.intent_slug,
        title=intent.title,
        h1=intent.h1,
        meta_description=intent.meta_description,
        intro_html=intent.intro_html,
        answer=answer_sentence(intent, matches_sorted),
        index_status=intent.index_status,
        robots=robots,
        canonical=f"{SITE}{intent.path}",
        quality_score=intent.quality_score,
        match_count=len(matches_sorted),
        last_updated=intent.last_built_at or intent.updated_at,
        verified_matches=[_card(p, intent.query) for p in matches_sorted],
        market_snapshot=_snap_public(snap, "Market snapshot"),
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
        methodology_note=METHODOLOGY,
    )


@router.get("/research/kigali-rental-market", response_model=ResearchOverviewResponse)
async def research_overview(db: AsyncSession = Depends(get_db)):
    verified = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.data_kind == MarketDataKind.VERIFIED_KIGALI_RENT.value,
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
        )
        .order_by(MarketStatSnapshot.period_end.desc())
        .limit(6)
    )
    observed = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.data_kind == MarketDataKind.MARKET_OBSERVATION.value,
            MarketStatSnapshot.location_slug == "kigali",
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
    summary = textual_summary(v_list[0] if v_list else None, "Kigali overall")
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
    result = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.location_slug != "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.sample_size >= 3,
        )
        .order_by(MarketStatSnapshot.period_end.desc(), MarketStatSnapshot.median_usd.desc())
        .limit(50)
    )
    # de-dupe by location keeping latest
    seen = set()
    items = []
    for s in result.scalars().all():
        if s.location_slug in seen:
            continue
        seen.add(s.location_slug)
        items.append(_snap_public(s, s.location_name or s.location_slug))
    return {"items": items}


@router.get("/research/kigali-rental-market/trends")
async def research_trends(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.data_kind == MarketDataKind.VERIFIED_KIGALI_RENT.value,
        )
        .order_by(MarketStatSnapshot.period_end.asc())
        .limit(36)
    )
    rows = list(result.scalars().all())
    series = [
        {
            "period_end": r.period_end.isoformat(),
            "median_usd": r.median_usd,
            "sample_size": r.sample_size,
            "data_kind": r.data_kind,
        }
        for r in rows
    ]
    activity = await observation_activity_series(db)
    return {
        "median_series": series,
        "observation_activity": activity,
        "disclaimer": "Observed listing activity is not total market supply.",
        "summary": textual_summary(rows[-1] if rows else None, "Kigali trends"),
    }


@router.get("/research/kigali-rental-market/methodology")
async def research_methodology():
    return {
        "title": "Methodology",
        "body": METHODOLOGY,
        "rules": [
            "USD is the primary public currency; RWF may be shown for transparency.",
            "Historical observations keep the exchange rate from the observation date.",
            "External listings that disappear are marked not_found — never assumed rented.",
            "Statistics are withheld when sample size is insufficient (minimum 3).",
            "Verified KigaliRent inventory is never mixed with observations without labels.",
        ],
    }


@router.get("/research/kigali-rental-market/sources")
async def research_sources(db: AsyncSession = Depends(get_db)):
    from app.models import RentalObservation
    from sqlalchemy import func

    result = await db.execute(
        select(RentalObservation.source, func.count())
        .group_by(RentalObservation.source)
        .order_by(func.count().desc())
    )
    sources = [{"source": s, "observation_count": c, "kind": "market_observation"} for s, c in result.all()]
    sources.insert(
        0,
        {
            "source": "KigaliRent verified inventory",
            "observation_count": None,
            "kind": "verified_kigali_rent",
        },
    )
    return {"sources": sources}


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
