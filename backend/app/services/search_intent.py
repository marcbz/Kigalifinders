"""Search-intent matching, quality gate, and relevance scoring."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.neighborhood_groups import expanded_neighborhood_slugs
from app.models import (
    Amenity,
    ListingType,
    MarketStatSnapshot,
    Neighborhood,
    Property,
    PropertyStatusEnum,
    PropertyType,
    SearchIndexStatus,
    SearchIntent,
    SearchLandingRelation,
    SitemapStatus,
)
from app.services.fx import effective_usd_price

MIN_SAMPLE_FOR_STATS = 3
MIN_MATCHES_FOR_INDEX = 1
MIN_QUALITY_FOR_INDEX = 40.0


def build_path(location_slug: str, intent_slug: str) -> str:
    return f"/rentals/{location_slug.strip('/').lower()}/{intent_slug.strip('/').lower()}"


async def _neighborhood_ids(db: AsyncSession, location_slug: str | None) -> list[UUID] | None:
    if not location_slug or location_slug.lower() in {"kigali", "all"}:
        return None
    slugs = expanded_neighborhood_slugs(location_slug.lower())
    result = await db.execute(
        select(Neighborhood.id).where(Neighborhood.slug.in_(slugs), Neighborhood.is_active == True)  # noqa: E712
    )
    ids = list(result.scalars().all())
    return ids or None


def _amenity_flags_from_query(query: dict[str, Any]) -> dict[str, bool]:
    from app.services.seo_attributes import amenity_property_flags, sanitize_seo_amenities

    amenities, _ = sanitize_seo_amenities(query.get("amenities") or [])
    return amenity_property_flags(amenities)


async def match_verified_properties(
    db: AsyncSession,
    query: dict[str, Any],
    *,
    limit: int = 24,
    include_unavailable: bool = False,
) -> list[Property]:
    location = (query.get("location") or query.get("location_slug") or "").lower() or None
    q = (
        select(Property)
        .options(
            selectinload(Property.neighborhood),
            selectinload(Property.district),
            selectinload(Property.property_type),
            selectinload(Property.images),
            selectinload(Property.amenities),
        )
        .where(Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]))
    )
    if include_unavailable:
        q = q.where(Property.status.in_([PropertyStatusEnum.PUBLISHED, PropertyStatusEnum.RENTED, PropertyStatusEnum.ARCHIVED]))
    else:
        q = q.where(Property.status == PropertyStatusEnum.PUBLISHED)

    nids = await _neighborhood_ids(db, location)
    if nids:
        q = q.where(Property.neighborhood_id.in_(nids))

    if query.get("bedrooms") is not None:
        q = q.where(Property.bedrooms >= int(query["bedrooms"]))
    if query.get("bathrooms") is not None:
        q = q.where(Property.bathrooms >= float(query["bathrooms"]))
    if query.get("furnished") is True or query.get("is_furnished") is True:
        q = q.where(or_(Property.is_furnished.is_(True), Property.listing_type == ListingType.FURNISHED))
    if query.get("furnished") is False or query.get("is_furnished") is False:
        q = q.where(Property.is_furnished.is_(False))

    ptype = (query.get("property_type") or query.get("property_type_slug") or "").lower() or None
    if ptype:
        type_result = await db.execute(select(PropertyType.id).where(PropertyType.slug == ptype))
        type_id = type_result.scalar_one_or_none()
        if type_id:
            tid = str(type_id)
            q = q.where(or_(Property.property_type_id == type_id, Property.property_type_ids.contains([tid])))
        else:
            # fuzzy name match via joined type name
            q = q.join(PropertyType, Property.property_type_id == PropertyType.id, isouter=True).where(
                or_(PropertyType.slug == ptype, PropertyType.name.ilike(f"%{ptype}%"))
            )

    min_usd = query.get("min_price_usd", query.get("min_price"))
    max_usd = query.get("max_price_usd", query.get("max_price"))
    # Prefer usd_price when set; fall back to price for USD listings
    if min_usd is not None:
        q = q.where(
            or_(
                Property.usd_price >= float(min_usd),
                and_(Property.usd_price.is_(None), Property.price >= float(min_usd)),
            )
        )
    if max_usd is not None:
        q = q.where(
            or_(
                Property.usd_price <= float(max_usd),
                and_(Property.usd_price.is_(None), Property.price <= float(max_usd)),
            )
        )

    flags = _amenity_flags_from_query(query)
    for col, val in flags.items():
        q = q.where(getattr(Property, col) == val)

    # compound (and any remaining allowed amenities without a boolean column) via amenity join
    from app.services.seo_attributes import sanitize_seo_amenities

    amenity_slugs = [str(a).lower() for a in (query.get("amenity_slugs") or [])]
    allowed_from_query, _ = sanitize_seo_amenities(query.get("amenities") or [])
    join_slugs = set(amenity_slugs)
    for slug in allowed_from_query:
        if slug == "compound":
            join_slugs.add("compound")
    if join_slugs:
        for slug in join_slugs:
            q = q.where(
                Property.amenities.any(Amenity.slug == slug)  # type: ignore[attr-defined]
            )

    q = q.order_by(Property.is_featured.desc(), Property.updated_at.desc()).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().unique().all())


def score_property(prop: Property, query: dict[str, Any]) -> float:
    """Transparent relevance score 0–100. No paid ranking."""
    score = 0.0
    location = (query.get("location") or query.get("location_slug") or "").lower()
    if location and location not in {"kigali", "all"}:
        nslug = prop.neighborhood.slug if prop.neighborhood else ""
        expanded = set(expanded_neighborhood_slugs(location))
        if nslug == location:
            score += 30
        elif nslug in expanded:
            score += 18
    else:
        score += 10

    want_beds = query.get("bedrooms")
    if want_beds is None:
        score += 10
    elif prop.bedrooms is not None:
        if prop.bedrooms == int(want_beds):
            score += 20
        elif prop.bedrooms >= int(want_beds):
            score += 12

    ptype = (query.get("property_type") or "").lower()
    if not ptype:
        score += 5
    elif prop.property_type and (
        prop.property_type.slug == ptype or ptype in (prop.property_type.name or "").lower()
    ):
        score += 12

    usd = effective_usd_price(prop)
    max_usd = query.get("max_price_usd", query.get("max_price"))
    min_usd = query.get("min_price_usd", query.get("min_price"))
    if usd is not None:
        if max_usd is not None and usd <= float(max_usd):
            score += 12
        if min_usd is not None and usd >= float(min_usd):
            score += 5
        if max_usd is None and min_usd is None:
            score += 5

    want_furnished = query.get("furnished", query.get("is_furnished"))
    if want_furnished is True and prop.is_furnished:
        score += 8
    elif want_furnished is None:
        score += 3

    flags = _amenity_flags_from_query(query)
    for col in flags:
        if getattr(prop, col, False):
            score += 4

    if prop.status == PropertyStatusEnum.PUBLISHED:
        score += 10
    if prop.data_source_kind == "verified_kigali_rent":
        score += 5

    verified = prop.last_verified_at
    if verified:
        age_days = (datetime.now(timezone.utc) - verified).days
        if age_days <= 7:
            score += 8
        elif age_days <= 30:
            score += 4

    return min(100.0, round(score, 1))


def quality_score_for_intent(
    match_count: int,
    has_price_stats: bool,
    location_known: bool,
    unique_copy: bool,
) -> float:
    score = 0.0
    score += min(40.0, match_count * 12.0)
    if has_price_stats:
        score += 20
    if location_known:
        score += 15
    if unique_copy:
        score += 15
    if match_count >= 3:
        score += 10
    return min(100.0, round(score, 1))


def recommend_index_status(quality: float, match_count: int) -> str:
    if match_count < MIN_MATCHES_FOR_INDEX or quality < MIN_QUALITY_FOR_INDEX:
        return SearchIndexStatus.NOINDEX.value
    return SearchIndexStatus.INDEXABLE.value


async def get_market_snapshot_for_query(db: AsyncSession, query: dict[str, Any]) -> MarketStatSnapshot | None:
    location = (query.get("location") or query.get("location_slug") or "kigali").lower()
    bedrooms = query.get("bedrooms")
    ptype = query.get("property_type")
    q = (
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.location_slug == location,
            MarketStatSnapshot.data_kind.in_(["verified_kigali_rent", "market_observation"]),
            MarketStatSnapshot.sample_size >= MIN_SAMPLE_FOR_STATS,
        )
        .order_by(MarketStatSnapshot.period_end.desc())
    )
    if bedrooms is not None:
        q = q.where(or_(MarketStatSnapshot.bedrooms == int(bedrooms), MarketStatSnapshot.bedrooms.is_(None)))
    if ptype:
        q = q.where(or_(MarketStatSnapshot.property_type == ptype, MarketStatSnapshot.property_type.is_(None)))
    result = await db.execute(q.limit(1))
    return result.scalar_one_or_none()


async def related_intents(db: AsyncSession, intent: SearchIntent, limit: int = 8) -> list[SearchIntent]:
    rel = await db.execute(
        select(SearchLandingRelation)
        .where(SearchLandingRelation.from_intent_id == intent.id)
        .order_by(SearchLandingRelation.sort_order.asc())
        .limit(limit)
    )
    rows = list(rel.scalars().all())
    if rows:
        ids = [r.to_intent_id for r in rows]
        result = await db.execute(select(SearchIntent).where(SearchIntent.id.in_(ids), SearchIntent.is_enabled == True))  # noqa: E712
        by_id = {i.id: i for i in result.scalars().all()}
        return [by_id[i] for i in ids if i in by_id]

    # Auto-related: same location or same bedrooms
    bedrooms = intent.query.get("bedrooms")
    q = (
        select(SearchIntent)
        .where(
            SearchIntent.id != intent.id,
            SearchIntent.is_enabled == True,  # noqa: E712
            SearchIntent.index_status.in_([SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.NOINDEX.value]),
            or_(
                SearchIntent.location_slug == intent.location_slug,
                SearchIntent.location_slug == "kigali",
            ),
        )
        .order_by(SearchIntent.quality_score.desc())
        .limit(limit)
    )
    result = await db.execute(q)
    items = list(result.scalars().all())
    if bedrooms is not None:
        items.sort(key=lambda i: 0 if i.query.get("bedrooms") == bedrooms else 1)
    return items[:limit]


def _district_group_for_hood(hood_slug: str | None) -> str | None:
    if not hood_slug:
        return None
    key = hood_slug.lower()
    from app.core.neighborhood_groups import NEIGHBORHOOD_GROUP_EXPANSIONS

    for group, members in NEIGHBORHOOD_GROUP_EXPANSIONS.items():
        if key == group or key in members:
            return group
    return None


def score_intent_for_property(
    intent: SearchIntent,
    *,
    hood_slug: str | None,
    district_slug: str | None,
    property_type_slug: str | None,
    bedrooms: int | None,
    is_furnished: bool,
) -> float | None:
    """
    Eligibility / soft relevance for showing a rental search next to a property.
    Returns None when the intent is clearly unrelated (wrong area).
    Ranking of eligible intents is handled separately (listing count → district → bedrooms).
    """
    from app.services.intent_copy import normalize_query

    loc = (intent.location_slug or "").lower()
    q = normalize_query(intent.query or {})
    hood = (hood_slug or "").lower() or None
    district = (district_slug or "").lower() or None
    group = _district_group_for_hood(hood) or district
    ptype = (property_type_slug or "").lower() or None

    score = 0.0

    # Location: neighborhood > district/group > kigali > other (reject)
    if hood and loc == hood:
        score += 100
    elif group and loc == group:
        score += 70
    elif district and loc == district:
        score += 65
    elif loc == "kigali":
        score += 25
    elif hood and loc in expanded_neighborhood_slugs(hood):
        score += 55
    else:
        return None

    intent_type = (q.get("property_type") or "").lower() or None
    if intent_type and ptype:
        if intent_type == ptype:
            score += 40
        else:
            score -= 25

    intent_beds = q.get("bedrooms")
    if intent_beds is not None and bedrooms is not None:
        if int(intent_beds) == int(bedrooms):
            score += 35
        else:
            score -= 15
    elif intent_beds is None:
        score += 4

    intent_furnished = q.get("furnished")
    if intent_furnished is True and is_furnished:
        score += 18
    elif intent_furnished is False and not is_furnished:
        score += 10
    elif intent_furnished is True and not is_furnished:
        score -= 8

    if intent.index_status == SearchIndexStatus.INDEXABLE.value:
        score += 8

    return score


def _district_rank_for_intent(
    intent: SearchIntent,
    *,
    hood_slug: str | None,
    district_slug: str | None,
) -> int:
    """Higher = stronger district match for secondary sort."""
    loc = (intent.location_slug or "").lower()
    hood = (hood_slug or "").lower() or None
    district = (district_slug or "").lower() or None
    group = _district_group_for_hood(hood) or district

    if district and loc == district:
        return 2
    if group and loc == group:
        return 2
    if hood and loc == hood:
        return 2
    if group and loc in expanded_neighborhood_slugs(group):
        return 1
    return 0


def _bedroom_rank_for_intent(intent: SearchIntent, bedrooms: int | None) -> int:
    """Higher = bedroom count matches the property (tertiary sort)."""
    if bedrooms is None:
        return 0
    from app.services.intent_copy import normalize_query

    q = normalize_query(intent.query or {})
    intent_beds = q.get("bedrooms")
    if intent_beds is not None and int(intent_beds) == int(bedrooms):
        return 1
    return 0


def _property_search_sort_key(
    match_count: int,
    district_rank: int,
    bedroom_rank: int,
) -> tuple[int, int, int]:
    """listing count DESC → district relevance → bedroom relevance."""
    return (match_count, district_rank, bedroom_rank)


MIN_RELATED_MATCHES = 3


def _normalize_search_label(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _intent_dedupe_keys(intent: SearchIntent) -> set[str]:
    """Identity keys so duplicate paths / filters / labels collapse."""
    from app.services.intent_copy import canonical_query_hash, normalize_query

    keys: set[str] = set()
    path = (intent.path or "").strip().rstrip("/").lower()
    if path:
        keys.add(f"path:{path}")
    q = intent.query or {}
    keys.add(f"hash:{intent.canonical_query_hash or canonical_query_hash(q)}")
    norm = normalize_query(q)
    loc = (intent.location_slug or norm.get("location") or "").lower()
    core = {
        "location": loc,
        "property_type": norm.get("property_type"),
        "bedrooms": norm.get("bedrooms"),
        "furnished": norm.get("furnished"),
        "bathrooms": norm.get("bathrooms"),
        "amenities": tuple(norm.get("amenities") or []),
        "min_price_usd": norm.get("min_price_usd"),
        "max_price_usd": norm.get("max_price_usd"),
    }
    keys.add(f"filters:{json.dumps(core, sort_keys=True, default=str)}")
    label = _normalize_search_label(intent.h1) or _normalize_search_label(intent.title)
    if label:
        keys.add(f"label:{label}")
    return keys


def _meaningful_combo_signature(
    intent: SearchIntent,
    *,
    hood_slug: str | None,
    district_slug: str | None,
    property_type_slug: str | None,
    bedrooms: int | None,
) -> str | None:
    """
    Accept type × location (± bedrooms) combos that match the viewed property.
    Returns a diversity signature, or None if not a meaningful related search.
    """
    from app.services.intent_copy import normalize_query

    q = normalize_query(intent.query or {})
    loc = (intent.location_slug or q.get("location") or "").lower()
    hood = (hood_slug or "").lower() or None
    district = (district_slug or "").lower() or None
    group = _district_group_for_hood(hood) or district
    ptype = (property_type_slug or "").lower() or None

    intent_type = (q.get("property_type") or "").lower() or None
    intent_beds = q.get("bedrooms")

    if ptype:
        if not intent_type or intent_type != ptype:
            return None

    if intent_beds is not None:
        if bedrooms is None or int(intent_beds) != int(bedrooms):
            return None

    if hood and loc == hood:
        loc_level = "neighborhood"
    elif (group and loc == group) or (district and loc == district):
        loc_level = "district"
    elif loc == "kigali":
        loc_level = "city"
    else:
        return None

    beds_part = "beds" if intent_beds is not None else "any"
    return f"{loc_level}:{beds_part}:type"


async def related_intents_for_property(
    db: AsyncSession,
    prop: Property,
    *,
    limit: int = 6,
) -> list[dict[str, Any]]:
    """
    Related /rentals/... searches for a property detail page.

    Pipeline: candidates → meaningful combos → match_count >= 3 → dedupe →
    sort by listing count DESC (district, then bedrooms) → max 6 with combo diversity.
    """
    hood_slug = prop.neighborhood.slug if prop.neighborhood else None
    district_slug = prop.district.slug if prop.district else None
    ptype_slug = prop.property_type.slug if prop.property_type else None
    bedrooms = prop.bedrooms
    is_furnished = bool(prop.is_furnished) or prop.listing_type == ListingType.FURNISHED
    limit = min(max(int(limit), 1), 6)

    preferred: set[str] = {"kigali"}
    if hood_slug:
        preferred.add(hood_slug.lower())
    if district_slug:
        preferred.add(district_slug.lower())
    group = _district_group_for_hood(hood_slug)
    if group:
        preferred.add(group)

    result = await db.execute(
        select(SearchIntent).where(
            SearchIntent.is_enabled == True,  # noqa: E712
            SearchIntent.index_status.in_(
                [SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.NOINDEX.value]
            ),
            SearchIntent.location_slug.in_(sorted(preferred)),
            SearchIntent.path.isnot(None),
            SearchIntent.match_count >= MIN_RELATED_MATCHES,
        )
    )
    candidates = list(result.scalars().all())

    # (match_count, district_rank, bedroom_rank, signature, intent)
    ranked: list[tuple[int, int, int, str, SearchIntent]] = []
    seen_identity: set[str] = set()

    def _try_add(intent: SearchIntent) -> None:
        path = (intent.path or "").strip()
        if not path.startswith("/rentals/"):
            return
        match_count = int(intent.match_count or 0)
        if match_count < MIN_RELATED_MATCHES:
            return
        if (
            score_intent_for_property(
                intent,
                hood_slug=hood_slug,
                district_slug=district_slug,
                property_type_slug=ptype_slug,
                bedrooms=bedrooms,
                is_furnished=is_furnished,
            )
            is None
        ):
            return
        signature = _meaningful_combo_signature(
            intent,
            hood_slug=hood_slug,
            district_slug=district_slug,
            property_type_slug=ptype_slug,
            bedrooms=bedrooms,
        )
        if signature is None:
            return
        keys = _intent_dedupe_keys(intent)
        if keys & seen_identity:
            return
        seen_identity.update(keys)
        ranked.append(
            (
                match_count,
                _district_rank_for_intent(intent, hood_slug=hood_slug, district_slug=district_slug),
                _bedroom_rank_for_intent(intent, bedrooms),
                signature,
                intent,
            )
        )

    for intent in candidates:
        _try_add(intent)

    if len(ranked) < limit:
        fallback = await db.execute(
            select(SearchIntent)
            .where(
                SearchIntent.is_enabled == True,  # noqa: E712
                SearchIntent.index_status.in_(
                    [SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.NOINDEX.value]
                ),
                SearchIntent.location_slug == "kigali",
                SearchIntent.path.isnot(None),
                SearchIntent.match_count >= MIN_RELATED_MATCHES,
            )
            .order_by(SearchIntent.match_count.desc(), SearchIntent.quality_score.desc())
            .limit(60)
        )
        for intent in fallback.scalars().all():
            _try_add(intent)

    ranked.sort(key=lambda row: _property_search_sort_key(row[0], row[1], row[2]), reverse=True)

    selected: list[tuple[int, int, int, str, SearchIntent]] = []
    used_signatures: set[str] = set()
    used_intent_ids: set[Any] = set()

    for row in ranked:
        sig = row[3]
        if sig in used_signatures:
            continue
        used_signatures.add(sig)
        used_intent_ids.add(row[4].id)
        selected.append(row)
        if len(selected) >= limit:
            break

    if len(selected) < limit:
        for row in ranked:
            if row[4].id in used_intent_ids:
                continue
            used_intent_ids.add(row[4].id)
            selected.append(row)
            if len(selected) >= limit:
                break

    selected.sort(key=lambda row: _property_search_sort_key(row[0], row[1], row[2]), reverse=True)

    out: list[dict[str, Any]] = []
    for match_count, _district, _beds, _sig, intent in selected[:limit]:
        path = (intent.path or "").rstrip("/") or intent.path
        if not path:
            continue
        out.append(
            {
                "path": path,
                "title": intent.title,
                "h1": intent.h1,
                "match_count": match_count,
                "location_slug": intent.location_slug,
                "intent_slug": intent.intent_slug,
            }
        )
    return out


async def rebuild_intent_metrics(db: AsyncSession, intent: SearchIntent) -> SearchIntent:
    from app.services.intent_automation import count_observations, compute_freshness, opportunity_score, specificity_score
    from app.services.intent_config import load_automation_config
    from app.services.intent_copy import canonical_query_hash, normalize_query

    cfg = await load_automation_config(db)
    q = normalize_query(intent.query or {})
    matches = await match_verified_properties(db, q, limit=50)
    intent.match_count = len(matches)
    intent.matching_observation_count = await count_observations(db, q)
    snap = await get_market_snapshot_for_query(db, q)
    location_known = bool(intent.location_slug)
    unique_copy = bool(intent.meta_description and intent.h1)
    intent.quality_score = quality_score_for_intent(
        intent.match_count,
        has_price_stats=snap is not None or intent.match_count >= MIN_SAMPLE_FOR_STATS,
        location_known=location_known,
        unique_copy=unique_copy,
    )
    intent.data_freshness = compute_freshness([m.last_verified_at for m in matches], cfg)
    intent.opportunity_score = opportunity_score(
        verified=intent.match_count,
        observations=intent.matching_observation_count,
        freshness=intent.data_freshness,
        specificity=specificity_score(q),
        uniqueness=8.0 if intent.location_slug != "kigali" else 4.0,
        gsc_impressions=intent.gsc_impressions,
    )
    intent.canonical_query_hash = intent.canonical_query_hash or canonical_query_hash(q)
    from app.services.seo_landing import is_manual_override, sync_sitemap_with_index

    if not is_manual_override(intent) and not intent.automation_disabled:
        if intent.index_status == SearchIndexStatus.DRAFT.value:
            pass
        elif intent.index_status == SearchIndexStatus.INDEXABLE.value and intent.quality_score < MIN_QUALITY_FOR_INDEX:
            intent.index_status = SearchIndexStatus.NOINDEX.value
            intent.status_reason = "Demoted: quality below threshold"
            intent.sitemap_status = SitemapStatus.EXCLUDED.value
    sync_sitemap_with_index(intent)
    intent.last_built_at = datetime.now(timezone.utc)
    intent.last_calculated_at = datetime.now(timezone.utc)
    intent.updated_at = datetime.now(timezone.utc)
    return intent


def answer_sentence(intent: SearchIntent, matches: list[Property]) -> str:
    h1 = intent.h1.rstrip(".")
    if not matches:
        return (
            f"KigaliRent currently has no verified properties matching “{h1}”. "
            "Below are nearby alternatives and related searches."
        )
    prices = [effective_usd_price(p) for p in matches]
    prices = [p for p in prices if p is not None]
    if prices:
        lo, hi = min(prices), max(prices)
        if lo == hi:
            price_bit = f"priced at ${lo:,.0f}/month"
        else:
            price_bit = f"ranging from ${lo:,.0f}–${hi:,.0f}/month"
        return (
            f"KigaliRent currently has {len(matches)} verified "
            f"{'match' if len(matches) == 1 else 'matches'} for “{h1}”, {price_bit}."
        )
    return f"KigaliRent currently has {len(matches)} verified {'match' if len(matches) == 1 else 'matches'} for “{h1}”."
