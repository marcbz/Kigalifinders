"""Permanent rental directory, city overview, and neighborhood guide pages."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    District,
    ListingType,
    MarketDataKind,
    MarketStatSnapshot,
    Neighborhood,
    Property,
    PropertyStatusEnum,
    SearchIndexStatus,
    SearchIntent,
)
from app.services.intent_automation import count_observations
from app.services.search_intent import MIN_SAMPLE_FOR_STATS, match_verified_properties, score_property

SITE = "https://kigalirent.com"

# Prefer existing city-level search intents as type hubs (do not invent new routes).
# Only surface when match_count meets the threshold — avoids thin type doorways.
TYPE_HUB_INTENT_SLUGS: tuple[tuple[str, str], ...] = (
    ("houses", "Houses for rent"),
    ("apartments", "Apartments for rent"),
    ("furnished-apartments", "Furnished apartments"),
    ("villas", "Villas for rent"),
)
MIN_TYPE_HUB_MATCHES = 3


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_label(text: str | None) -> str:
    return " ".join((text or "").lower().split())


async def _type_hubs_for_kigali(db: AsyncSession) -> list[dict[str, Any]]:
    """Link directory to existing /rentals/kigali/{intent} pages with real inventory."""
    slugs = [s for s, _ in TYPE_HUB_INTENT_SLUGS]
    result = await db.execute(
        select(SearchIntent).where(
            SearchIntent.location_slug == "kigali",
            SearchIntent.intent_slug.in_(slugs),
            SearchIntent.is_enabled == True,  # noqa: E712
            SearchIntent.index_status == SearchIndexStatus.INDEXABLE.value,
            SearchIntent.match_count >= MIN_TYPE_HUB_MATCHES,
        )
    )
    by_slug = {i.intent_slug: i for i in result.scalars().all()}
    out: list[dict[str, Any]] = []
    for slug, label in TYPE_HUB_INTENT_SLUGS:
        intent = by_slug.get(slug)
        if not intent:
            continue
        out.append(
            {
                "slug": slug,
                "label": label,
                "path": intent.path,
                "h1": intent.h1,
                "match_count": intent.match_count,
            }
        )
    return out


def _dedupe_featured_searches(items: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    """Prefer distinct intents: path + normalized H1 (avoids houses-with-garden twin of houses)."""
    seen_paths: set[str] = set()
    seen_labels: set[str] = set()
    featured: list[dict[str, Any]] = []
    # Prefer shorter, simpler intent slugs when H1s collide
    ranked = sorted(
        items,
        key=lambda s: (
            -(s.get("match_count") or 0),
            len((s.get("path") or "").split("/")),
            len(s.get("path") or ""),
        ),
    )
    for s in ranked:
        path = s.get("path") or ""
        if not path.startswith("/rentals/") or path in seen_paths:
            continue
        label = _normalize_label(s.get("h1") or s.get("title"))
        if label and label in seen_labels:
            continue
        seen_paths.add(path)
        if label:
            seen_labels.add(label)
        featured.append(s)
        if len(featured) >= limit:
            break
    return featured


async def _latest_snapshot(
    db: AsyncSession,
    *,
    location_slug: str,
    data_kind: str,
    bedrooms: int | None = None,
    property_type: str | None = None,
    min_sample: int = MIN_SAMPLE_FOR_STATS,
) -> MarketStatSnapshot | None:
    q = (
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.location_slug == location_slug,
            MarketStatSnapshot.data_kind == data_kind,
            MarketStatSnapshot.sample_size >= min_sample,
        )
        .order_by(MarketStatSnapshot.period_end.desc())
    )
    if bedrooms is None:
        q = q.where(MarketStatSnapshot.bedrooms.is_(None))
    else:
        q = q.where(MarketStatSnapshot.bedrooms == bedrooms)
    if property_type is None:
        q = q.where(MarketStatSnapshot.property_type.is_(None))
    else:
        q = q.where(MarketStatSnapshot.property_type == property_type)
    return (await db.execute(q.limit(1))).scalar_one_or_none()


async def _snapshots_by_bedroom(db: AsyncSession, location_slug: str, data_kind: str) -> list[dict[str, Any]]:
    rows = list(
        (
            await db.execute(
                select(MarketStatSnapshot)
                .where(
                    MarketStatSnapshot.location_slug == location_slug,
                    MarketStatSnapshot.data_kind == data_kind,
                    MarketStatSnapshot.bedrooms.is_not(None),
                    MarketStatSnapshot.property_type.is_(None),
                    MarketStatSnapshot.sample_size >= MIN_SAMPLE_FOR_STATS,
                )
                .order_by(MarketStatSnapshot.period_end.desc(), MarketStatSnapshot.bedrooms.asc())
                .limit(40)
            )
        ).scalars().all()
    )
    seen: set[int] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        if row.bedrooms in seen:
            continue
        seen.add(row.bedrooms)
        out.append(
            {
                "bedrooms": row.bedrooms,
                "median_usd": row.median_usd,
                "p25_usd": row.p25_usd,
                "p75_usd": row.p75_usd,
                "sample_size": row.sample_size,
                "period_end": row.period_end.isoformat() if row.period_end else None,
            }
        )
    return sorted(out, key=lambda x: x["bedrooms"] or 0)


async def _property_type_breakdown(db: AsyncSession, location_slug: str) -> list[dict[str, Any]]:
    from app.models import PropertyType

    if location_slug == "kigali":
        rows = await db.execute(
            select(PropertyType.slug, PropertyType.name, func.count(Property.id))
            .join(Property, Property.property_type_id == PropertyType.id)
            .where(
                Property.status == PropertyStatusEnum.PUBLISHED,
                Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]),
            )
            .group_by(PropertyType.slug, PropertyType.name)
            .order_by(func.count(Property.id).desc())
        )
        return [{"slug": slug, "name": name, "count": int(cnt)} for slug, name, cnt in rows.all()]

    nids = await db.execute(
        select(Neighborhood.id).where(Neighborhood.slug == location_slug, Neighborhood.is_active == True)  # noqa: E712
    )
    ids = list(nids.scalars().all())
    if not ids:
        return []
    rows = await db.execute(
        select(PropertyType.slug, PropertyType.name, func.count(Property.id))
        .join(Property, Property.property_type_id == PropertyType.id)
        .where(
            Property.neighborhood_id.in_(ids),
            Property.status == PropertyStatusEnum.PUBLISHED,
            Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]),
        )
        .group_by(PropertyType.slug, PropertyType.name)
        .order_by(func.count(Property.id).desc())
    )
    return [{"slug": slug, "name": name, "count": int(cnt)} for slug, name, cnt in rows.all()]


async def _furnished_counts(db: AsyncSession, location_slug: str) -> dict[str, int]:
    query = {"location": location_slug}
    all_props = await match_verified_properties(db, query, limit=200)
    furnished = sum(1 for p in all_props if p.is_furnished or p.listing_type == ListingType.FURNISHED)
    return {"furnished": furnished, "unfurnished": max(0, len(all_props) - furnished), "total": len(all_props)}


def _snap_dict(snap: MarketStatSnapshot | None, label: str) -> dict[str, Any] | None:
    if not snap or snap.sample_size < MIN_SAMPLE_FOR_STATS:
        return None
    from app.services.research import textual_summary

    return {
        "data_kind": snap.data_kind,
        "sample_size": snap.sample_size,
        "median_usd": snap.median_usd,
        "p25_usd": snap.p25_usd,
        "p75_usd": snap.p75_usd,
        "min_usd": snap.min_usd,
        "max_usd": snap.max_usd,
        "period_end": snap.period_end.isoformat() if snap.period_end else None,
        "common_amenities": snap.common_amenities,
        "summary": textual_summary(snap, label),
        "label": label,
    }


async def _related_intents_for_location(db: AsyncSession, location_slug: str, limit: int = 8) -> list[dict[str, str]]:
    result = await db.execute(
        select(SearchIntent)
        .where(
            SearchIntent.location_slug == location_slug,
            SearchIntent.is_enabled == True,  # noqa: E712
            SearchIntent.index_status != SearchIndexStatus.DISABLED.value,
        )
        .order_by(SearchIntent.match_count.desc(), SearchIntent.quality_score.desc())
        .limit(limit)
    )
    return [
        {"path": i.path, "title": i.title, "h1": i.h1, "match_count": i.match_count}
        for i in result.scalars().all()
    ]


async def _neighborhoods_with_counts(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Neighborhood, District.name)
        .join(District, Neighborhood.district_id == District.id)
        .where(Neighborhood.is_active == True)  # noqa: E712
        .order_by(Neighborhood.name.asc())
    )
    out: list[dict[str, Any]] = []
    for hood, district_name in result.all():
        count = int(
            (
                await db.execute(
                    select(func.count())
                    .select_from(Property)
                    .where(
                        Property.neighborhood_id == hood.id,
                        Property.status == PropertyStatusEnum.PUBLISHED,
                        Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]),
                    )
                )
            ).scalar()
            or 0
        )
        verified_snap = await _latest_snapshot(
            db,
            location_slug=hood.slug,
            data_kind=MarketDataKind.VERIFIED_KIGALI_RENT.value,
        )
        out.append(
            {
                "slug": hood.slug,
                "name": hood.name,
                "district_name": district_name,
                "listing_count": count,
                "median_usd": verified_snap.median_usd if verified_snap else None,
                "path": f"/rentals/{hood.slug}",
            }
        )
    return out


def _listing_card(prop, query: dict) -> dict[str, Any]:
    from app.services.fx import effective_usd_price

    primary = next((img.url for img in prop.images if img.is_primary), None)
    if not primary and prop.images:
        primary = prop.images[0].url
    return {
        "id": str(prop.id),
        "title": prop.title,
        "slug": prop.slug,
        "price": prop.price,
        "usd_price": effective_usd_price(prop),
        "currency": prop.currency,
        "bedrooms": prop.bedrooms,
        "bathrooms": prop.bathrooms,
        "is_furnished": prop.is_furnished,
        "has_pool": prop.has_pool,
        "has_parking": prop.has_parking,
        "neighborhood_name": prop.neighborhood.name if prop.neighborhood else None,
        "property_type_name": prop.property_type.name if prop.property_type else None,
        "primary_image": primary,
        "last_verified_at": prop.last_verified_at.isoformat() if prop.last_verified_at else None,
        "data_source_kind": prop.data_source_kind or "verified_kigali_rent",
        "status": prop.status.value if hasattr(prop.status, "value") else str(prop.status),
        "relevance_score": score_property(prop, query),
    }


async def build_rental_directory(db: AsyncSession) -> dict[str, Any]:
    neighborhoods = await _neighborhoods_with_counts(db)
    neighborhoods.sort(key=lambda n: (-n["listing_count"], n["name"]))
    total_listings = sum(n["listing_count"] for n in neighborhoods)
    kigali_verified = await _latest_snapshot(
        db, location_slug="kigali", data_kind=MarketDataKind.VERIFIED_KIGALI_RENT.value
    )
    kigali_observed = await _latest_snapshot(
        db, location_slug="kigali", data_kind=MarketDataKind.MARKET_OBSERVATION.value, min_sample=1
    )
    top_searches = await _related_intents_for_location(db, "kigali", limit=8)
    for hood in neighborhoods[:12]:
        if hood["listing_count"] >= 1:
            top_searches.extend(await _related_intents_for_location(db, hood["slug"], limit=2))
    featured = _dedupe_featured_searches(top_searches, limit=8)

    intro_parts = [
        f"KigaliRent lists {total_listings} verified rental propert{'y' if total_listings == 1 else 'ies'}"
        f" across {sum(1 for n in neighborhoods if n['listing_count'] > 0)} Kigali neighborhoods."
    ]
    if kigali_verified and kigali_verified.median_usd:
        intro_parts.append(
            f"City-wide verified rents typically centre around ${kigali_verified.median_usd:,.0f}/month "
            f"(based on {kigali_verified.sample_size} listings)."
        )

    from app.services.combined_market import combined_market_answer

    market_answer = await combined_market_answer(db, location_slug="kigali")
    type_hubs = await _type_hubs_for_kigali(db)
    listing_matches = await match_verified_properties(db, {"location": "kigali"}, limit=9)
    listing_sorted = sorted(
        listing_matches, key=lambda p: score_property(p, {"location": "kigali"}), reverse=True
    )

    return {
        "page_type": "directory",
        "path": "/rentals",
        "title": "Kigali Rentals Directory | KigaliRent",
        "h1": "Kigali rental directory",
        "meta_description": "Browse verified Kigali rentals by neighborhood, with real listing counts and market data.",
        "canonical": f"{SITE}/rentals",
        "robots": "index,follow",
        "intro": " ".join(intro_parts),
        "last_updated": _now().isoformat(),
        "total_listings": total_listings,
        "neighborhood_count": len(neighborhoods),
        "neighborhoods": neighborhoods,
        "market_answer": market_answer,
        "verified_market": _snap_dict(kigali_verified, "KigaliRent Verified"),
        "observation_market": None,
        "property_types": await _property_type_breakdown(db, "kigali"),
        "type_hubs": type_hubs,
        "verified_listings": [_listing_card(p, {"location": "kigali"}) for p in listing_sorted],
        "featured_searches": featured,
        "related_searches": featured,
    }


async def build_kigali_overview(db: AsyncSession) -> dict[str, Any]:
    from app.services.combined_market import combined_slice_context
    from app.services.landing_pages import build_data_insights

    neighborhoods = await _neighborhoods_with_counts(db)
    neighborhoods.sort(key=lambda n: (-(n["median_usd"] or 0), -n["listing_count"]))
    matches = await match_verified_properties(db, {"location": "kigali"}, limit=12)
    matches_sorted = sorted(matches, key=lambda p: score_property(p, {"location": "kigali"}), reverse=True)

    market_ctx = await combined_slice_context(db, location_slug="kigali")
    market_answer = market_ctx["market_answer"]
    furnished_market = market_ctx.get("furnished_breakdown") or {}
    furnished_payload = {
        "furnished": (furnished_market.get("furnished") or {}).get("sample_size", 0),
        "unfurnished": (furnished_market.get("unfurnished") or {}).get("sample_size", 0),
        "total": (
            (furnished_market.get("furnished") or {}).get("sample_size", 0)
            + (furnished_market.get("unfurnished") or {}).get("sample_size", 0)
        ),
    }

    intro = (
        "Overview of the Kigali rental market using combined eligible observations"
        + (
            f" (typical asking rent ${market_answer['typical_usd']:,.0f}/month based on {market_answer.get('sample_size')} observations)."
            if market_answer.get("has_enough_data") and market_answer.get("typical_usd") is not None
            else "."
        )
        + f" {len(matches)} verified KigaliRent listings are available separately below."
    )

    return {
        "page_type": "city",
        "path": "/rentals/kigali",
        "location_slug": "kigali",
        "location_name": "Kigali",
        "title": "Kigali Rental Market Overview | KigaliRent",
        "h1": "Kigali rental market overview",
        "meta_description": "Verified Kigali rental listings and combined market asking-rent estimates.",
        "canonical": f"{SITE}/rentals/kigali",
        "robots": "index,follow",
        "intro": intro,
        "last_updated": _now().isoformat(),
        "listing_count": len(matches),
        "observation_count": market_answer.get("sample_size") or 0,
        "market_answer": market_answer,
        "verified_market": None,
        "observation_market": None,
        "by_bedroom_verified": market_ctx.get("by_bedroom") or [],
        "by_bedroom_external": [],
        "furnished_breakdown": furnished_payload if furnished_payload["total"] else None,
        "property_types": await _property_type_breakdown(db, "kigali"),
        "key_attributes": ["Kigali-wide", "All property types"],
        "data_insights": build_data_insights(
            match_count=len(matches),
            market_insights=market_ctx.get("data_insights") or [],
        ),
        "trend_verified": market_ctx.get("trend") or [],
        "trend_external": [],
        "neighborhoods": [n for n in neighborhoods if n["listing_count"] > 0][:20],
        "verified_listings": [_listing_card(p, {"location": "kigali"}) for p in matches_sorted],
        "type_hubs": await _type_hubs_for_kigali(db),
        "related_searches": _dedupe_featured_searches(
            await _related_intents_for_location(db, "kigali", limit=16),
            limit=8,
        ),
        "related_neighborhoods": [
            {"slug": n["slug"], "name": n["name"], "path": n["path"], "listing_count": n["listing_count"]}
            for n in sorted(neighborhoods, key=lambda x: -x["listing_count"])[:8]
            if n["listing_count"] > 0
        ],
        "faqs": [
            {
                "q": "How much does renting in Kigali typically cost?",
                "a": market_answer.get("summary")
                or "Not enough data to provide a reliable estimate yet.",
            },
            {
                "q": "Are these confirmed lease prices?",
                "a": "No. Figures are asking rents from eligible observations, not confirmed transactions. Verified listings below are current inventory.",
            },
        ],
    }


async def build_neighborhood_guide(db: AsyncSession, slug: str) -> dict[str, Any] | None:
    from app.services.combined_market import combined_slice_context
    from app.services.landing_pages import build_data_insights, key_attributes_from_query

    result = await db.execute(
        select(Neighborhood, District.name)
        .join(District, Neighborhood.district_id == District.id)
        .where(Neighborhood.slug == slug.lower(), Neighborhood.is_active == True)  # noqa: E712
    )
    row = result.first()
    if not row:
        return None
    hood, district_name = row
    query = {"location": hood.slug}
    matches = await match_verified_properties(db, query, limit=24)
    matches_sorted = sorted(matches, key=lambda p: score_property(p, query), reverse=True)
    all_hoods = await _neighborhoods_with_counts(db)

    market_ctx = await combined_slice_context(db, location_slug=hood.slug)
    market_answer = market_ctx["market_answer"]
    furnished_market = market_ctx.get("furnished_breakdown") or {}
    furnished_payload = {
        "furnished": (furnished_market.get("furnished") or {}).get("sample_size", 0),
        "unfurnished": (furnished_market.get("unfurnished") or {}).get("sample_size", 0),
        "total": (
            (furnished_market.get("furnished") or {}).get("sample_size", 0)
            + (furnished_market.get("unfurnished") or {}).get("sample_size", 0)
        ),
    }

    listing_word = "listings" if len(matches) != 1 else "listing"
    verb = "are" if len(matches) != 1 else "is"
    if market_answer.get("has_enough_data") and market_answer.get("typical_usd") is not None:
        market_bit = (
            f" (typical asking rent ${market_answer['typical_usd']:,.0f}/month, "
            f"n={market_answer.get('sample_size')})."
        )
    else:
        market_bit = "."
    intro = (
        f"{hood.name} market context uses combined eligible observations{market_bit} "
        f"{len(matches)} verified rental {listing_word} {verb} currently available on KigaliRent "
        f"in {district_name}."
    )

    related = [n for n in all_hoods if n["slug"] != hood.slug and n["listing_count"] > 0]
    related.sort(key=lambda n: -n["listing_count"])

    property_word = "property" if len(matches) == 1 else "properties"
    return {
        "page_type": "neighborhood",
        "path": f"/rentals/{hood.slug}",
        "location_slug": hood.slug,
        "location_name": hood.name,
        "district_name": district_name,
        "title": f"Rentals in {hood.name}, Kigali | KigaliRent",
        "h1": f"Rentals in {hood.name}",
        "meta_description": (
            f"Verified rentals in {hood.name}, {district_name}. "
            "Combined market asking-rent estimates and current inventory."
        ),
        "canonical": f"{SITE}/rentals/{hood.slug}",
        "robots": (
            "index,follow"
            if len(matches) >= 1 or market_answer.get("has_enough_data")
            else "noindex,follow"
        ),
        "intro": intro,
        "last_updated": _now().isoformat(),
        "listing_count": len(matches),
        "observation_count": market_answer.get("sample_size") or 0,
        "market_answer": market_answer,
        "verified_market": None,
        "observation_market": None,
        "by_bedroom_verified": market_ctx.get("by_bedroom") or [],
        "by_bedroom_external": [],
        "furnished_breakdown": furnished_payload if furnished_payload["total"] else None,
        "property_types": await _property_type_breakdown(db, hood.slug),
        "key_attributes": key_attributes_from_query(query),
        "data_insights": build_data_insights(
            match_count=len(matches),
            market_insights=market_ctx.get("data_insights") or [],
        ),
        "trend_verified": market_ctx.get("trend") or [],
        "trend_external": [],
        "verified_listings": [_listing_card(p, query) for p in matches_sorted],
        "related_searches": _dedupe_featured_searches(
            await _related_intents_for_location(db, hood.slug, limit=12),
            limit=8,
        ),
        "related_neighborhoods": [
            {"slug": n["slug"], "name": n["name"], "path": n["path"], "listing_count": n["listing_count"]}
            for n in related[:8]
        ],
        "faqs": [
            {
                "q": f"How many verified rentals are in {hood.name}?",
                "a": (
                    f"KigaliRent currently lists {len(matches)} verified rental "
                    f"{property_word} in {hood.name}."
                ),
            },
            {
                "q": f"What is the typical asking rent in {hood.name}?",
                "a": market_answer.get("summary")
                or "Not enough data to provide a reliable estimate yet.",
            },
        ],
    }


async def build_location_page(db: AsyncSession, slug: str) -> dict[str, Any] | None:
    slug = slug.lower().strip("/")
    if slug == "kigali":
        return await build_kigali_overview(db)
    return await build_neighborhood_guide(db, slug)
