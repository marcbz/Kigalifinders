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


def _listing_date(prop: Property) -> datetime:
    """Prefer published/created listing date — not updated_at (metadata churn)."""
    for value in (prop.published_at, prop.created_at):
        if value is not None:
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value
    return datetime.min.replace(tzinfo=timezone.utc)


def sort_by_listing_freshness(props: list[Property]) -> list[Property]:
    """Newest published (then created) first within an already-selected matching group."""
    return sorted(props, key=_listing_date, reverse=True)


def sort_by_query_relevance(props: list[Property], query: dict[str, Any]) -> list[Property]:
    """Keyword/attribute relevance to the page query, then newest listing.

    Exact property-type matches rank above villa/house/apartment family matches.
    """
    wants_type = bool(
        (query.get("property_type") or query.get("property_type_slug") or "").strip()
    )
    return sorted(
        props,
        key=lambda p: (
            1 if (not wants_type or _property_type_exact(p, query)) else 0,
            score_property(p, query),
            _listing_date(p),
        ),
        reverse=True,
    )


def sort_by_related_search_relevance(
    props: list[Property],
    related_searches: list[dict[str, Any]],
) -> list[Property]:
    """Rank listings by how well they match Related rental search intents.

    Uses each related search's structured query (beds/type/location/budget/…) weighted by
    that search's match_count — the same inventory signals that drive the related list.
    """
    weighted: list[tuple[dict[str, Any], int]] = []
    for item in related_searches:
        q = item.get("query")
        if isinstance(q, dict) and q:
            weighted.append((q, max(1, int(item.get("match_count") or 1))))
        else:
            # Derive a lightweight query from path/h1 keywords when query payload is missing.
            derived = _query_from_related_search_item(item)
            if derived:
                weighted.append((derived, max(1, int(item.get("match_count") or 1))))

    if not weighted:
        return sort_by_listing_freshness(props)

    def _aggregate(prop: Property) -> tuple[float, float, datetime]:
        best = 0.0
        total = 0.0
        for q, weight in weighted:
            s = score_property(prop, q)
            best = max(best, s)
            total += s * float(weight)
        return (best, total, _listing_date(prop))

    return sorted(props, key=_aggregate, reverse=True)


def _query_from_related_search_item(item: dict[str, Any]) -> dict[str, Any]:
    """Best-effort query from related-search path/h1 when intent.query is absent."""
    path = (item.get("path") or "").strip("/").lower()
    parts = [p for p in path.split("/") if p]
    q: dict[str, Any] = {}
    if len(parts) >= 2 and parts[0] == "rentals":
        loc = parts[1]
        if loc and loc != "kigali":
            q["location"] = loc
        else:
            q["location"] = "kigali"
        if len(parts) >= 3:
            slug = parts[2]
            bed_m = re.search(r"(\d+)-bedroom", slug)
            if bed_m:
                q["bedrooms"] = int(bed_m.group(1))
            if "furnished" in slug:
                q["furnished"] = True
            under_m = re.search(r"under-(\d+)", slug)
            if under_m:
                q["max_price_usd"] = int(under_m.group(1))
            for ptype in ("villa", "house", "apartment", "studio"):
                if ptype in slug or f"{ptype}s" in slug:
                    q["property_type"] = ptype
                    break
    return q


def location_match_rank(prop: Property, query: dict[str, Any]) -> int:
    """Higher = more precise location match within an already-eligible set."""
    location = (query.get("location") or query.get("location_slug") or "").lower()
    if not location or location in {"kigali", "all"}:
        return 0
    nslug = prop.neighborhood.slug if prop.neighborhood else ""
    if nslug == location:
        return 2
    if nslug in set(expanded_neighborhood_slugs(location)):
        return 1
    return 0


def rank_matched_properties(props: list[Property], query: dict[str, Any]) -> list[Property]:
    """Legacy helper for non-hub callers: location precision, then newest listing."""
    return sorted(
        props,
        key=lambda p: (location_match_rank(p, query), _listing_date(p)),
        reverse=True,
    )


# Criterion weights are used only to choose which matching *group* to keep.
# They are not used to rank listings inside that group.
_CRITERION_WEIGHTS: dict[str, int] = {
    "bedrooms": 100,
    "location": 90,
    "budget": 80,
    "furnished": 55,
    "property_type": 35,  # useful signal, never allowed to empty a useful page alone
    "bathrooms": 25,
    "amenities": 15,
}


def _requested_criteria(query: dict[str, Any]) -> list[str]:
    """Optional filters present on the search (order does not define ranking)."""
    criteria: list[str] = []
    loc = (query.get("location") or query.get("location_slug") or "").lower()
    if loc and loc not in {"kigali", "all"}:
        criteria.append("location")
    if query.get("bedrooms") is not None:
        criteria.append("bedrooms")
    if query.get("max_price_usd", query.get("max_price")) is not None or query.get(
        "min_price_usd", query.get("min_price")
    ) is not None:
        criteria.append("budget")
    if query.get("furnished") is True or query.get("is_furnished") is True:
        criteria.append("furnished")
    elif query.get("furnished") is False or query.get("is_furnished") is False:
        criteria.append("furnished")
    ptype = (query.get("property_type") or query.get("property_type_slug") or "").strip()
    if ptype:
        criteria.append("property_type")
    if query.get("bathrooms") is not None:
        criteria.append("bathrooms")
    flags = _amenity_flags_from_query(query)
    amenity_slugs = [str(a).lower() for a in (query.get("amenity_slugs") or [])]
    if flags or amenity_slugs or (query.get("amenities") or []):
        criteria.append("amenities")
    return criteria


def _property_type_tokens(prop: Property) -> set[str]:
    tokens: set[str] = set()
    if prop.property_type:
        if prop.property_type.slug:
            tokens.add(prop.property_type.slug.lower())
        if prop.property_type.name:
            tokens.add(prop.property_type.name.lower())
            tokens.update(prop.property_type.name.lower().replace("-", " ").split())
    return tokens


# Villa, house, and apartment are interchangeable when exact-type inventory is thin.
_RESIDENTIAL_TYPE_FAMILY = frozenset(
    {
        "villa",
        "villas",
        "house",
        "houses",
        "home",
        "homes",
        "apartment",
        "apartments",
        "flat",
        "flats",
        "duplex",
        "townhouse",
        "townhouses",
    }
)


def _normalize_type_stem(value: str) -> str:
    raw = (value or "").lower().strip().replace("_", "-")
    raw = raw.replace("-", " ")
    stem = raw.rstrip("s") if raw.endswith("s") and not raw.endswith("ss") else raw
    aliases = {
        "flat": "apartment",
        "home": "house",
        "townhouse": "house",
        "duplex": "house",
        "apt": "apartment",
    }
    return aliases.get(stem, stem)


def _is_residential_type(value: str) -> bool:
    return _normalize_type_stem(value) in {
        _normalize_type_stem(t) for t in _RESIDENTIAL_TYPE_FAMILY
    } or value.lower().strip() in _RESIDENTIAL_TYPE_FAMILY


def _property_type_compatible(
    want: str,
    tokens: set[str],
    *,
    allow_family: bool,
) -> bool:
    """Exact type match, or residential family match (villa/house/apartment) when allowed."""
    if not want:
        return True
    want_l = want.lower().strip()
    want_stem = _normalize_type_stem(want_l)
    if any(want_l in t or want_stem in _normalize_type_stem(t) or t in want_l for t in tokens):
        return True
    if not allow_family or not _is_residential_type(want_l):
        return False
    return any(_is_residential_type(t) for t in tokens)


def _property_type_exact(prop: Property, query: dict[str, Any]) -> bool:
    want = (query.get("property_type") or query.get("property_type_slug") or "").lower().strip()
    if not want:
        return True
    return _property_type_compatible(want, _property_type_tokens(prop), allow_family=False)


def _criterion_holds(
    prop: Property,
    query: dict[str, Any],
    criterion: str,
    *,
    type_family: bool = False,
) -> bool:
    if criterion == "location":
        return location_match_rank(prop, query) >= 1
    if criterion == "bedrooms":
        want = query.get("bedrooms")
        return want is not None and prop.bedrooms is not None and int(prop.bedrooms) == int(want)
    if criterion == "budget":
        price = effective_usd_price(prop)
        if price is None:
            return False
        min_usd = query.get("min_price_usd", query.get("min_price"))
        max_usd = query.get("max_price_usd", query.get("max_price"))
        if min_usd is not None and price < float(min_usd):
            return False
        if max_usd is not None and price > float(max_usd):
            return False
        return True
    if criterion == "furnished":
        want = query.get("furnished")
        if want is None:
            want = query.get("is_furnished")
        is_furn = bool(prop.is_furnished) or prop.listing_type == ListingType.FURNISHED
        if want is True:
            return is_furn
        if want is False:
            return not is_furn
        return True
    if criterion == "property_type":
        want = (query.get("property_type") or query.get("property_type_slug") or "").lower().strip()
        if not want:
            return True
        return _property_type_compatible(
            want, _property_type_tokens(prop), allow_family=type_family
        )
    if criterion == "bathrooms":
        want = query.get("bathrooms")
        return want is not None and prop.bathrooms is not None and float(prop.bathrooms) >= float(want)
    if criterion == "amenities":
        flags = _amenity_flags_from_query(query)
        for col, val in flags.items():
            if getattr(prop, col, None) != val:
                return False
        from app.services.seo_attributes import sanitize_seo_amenities

        amenity_slugs = {str(a).lower() for a in (query.get("amenity_slugs") or [])}
        allowed, _ = sanitize_seo_amenities(query.get("amenities") or [])
        amenity_slugs.update(allowed)
        if amenity_slugs:
            have = {a.slug.lower() for a in (prop.amenities or []) if getattr(a, "slug", None)}
            if not amenity_slugs.issubset(have):
                return False
        return True
    return True


def _subset_score(subset: frozenset[str], match_count: int, limit: int) -> tuple[int, int, int]:
    """Higher is better: more criteria kept, higher total weight, then useful inventory depth."""
    weight = sum(_CRITERION_WEIGHTS.get(c, 0) for c in subset)
    depth = min(match_count, max(limit, 1))
    return (len(subset), weight, depth)


_CORE_CRITERIA = frozenset({"bedrooms", "location", "budget", "furnished", "property_type"})


def _select_best_subset(
    props: list[Property],
    query: dict[str, Any],
    *,
    criteria: list[str],
    requested_core: frozenset[str],
    limit: int,
    type_family: bool,
) -> tuple[frozenset[str] | None, list[Property], tuple[int, int, int] | None]:
    best_subset: frozenset[str] | None = None
    best_matches: list[Property] = []
    best_score: tuple[int, int, int] | None = None
    n = len(criteria)
    for mask in range((1 << n) - 1, 0, -1):
        subset = frozenset(criteria[i] for i in range(n) if mask & (1 << i))
        if requested_core and not (subset & requested_core):
            continue
        matched = [
            p
            for p in props
            if all(_criterion_holds(p, query, c, type_family=type_family) for c in subset)
        ]
        if not matched:
            continue
        score = _subset_score(subset, len(matched), limit)
        if best_score is None or score > best_score:
            best_score = score
            best_subset = subset
            best_matches = matched
    return best_subset, best_matches, best_score


def select_progressive_match_group(
    props: list[Property],
    query: dict[str, Any],
    *,
    limit: int,
) -> tuple[list[Property], str, frozenset[str]]:
    """Pick the strongest useful criterion combination from available inventory.

    Evaluates criterion subsets against real inventory (not a fixed drop order).
    Property type is a soft signal. When exact villa/house/apartment inventory is
    thin, those residential types are treated as interchangeable to fill the cap.
    Within the winning group, rank by query relevance then freshness.
    """
    criteria = _requested_criteria(query)
    full = frozenset(criteria)
    requested_core = full & _CORE_CRITERIA
    wants_type = "property_type" in full

    if not criteria:
        selected = sort_by_query_relevance(props, query)[:limit]
        return selected, "exact", frozenset()

    best_subset, best_matches, best_score = _select_best_subset(
        props,
        query,
        criteria=criteria,
        requested_core=requested_core,
        limit=limit,
        type_family=False,
    )

    # Not enough exact-type inventory: treat villa, house, and apartment as the same family.
    used_family = False
    if wants_type and (best_subset is None or len(best_matches) < limit):
        fam_subset, fam_matches, fam_score = _select_best_subset(
            props,
            query,
            criteria=criteria,
            requested_core=requested_core,
            limit=limit,
            type_family=True,
        )
        use_family = bool(fam_matches) and (
            best_subset is None
            or fam_score is None
            or best_score is None
            or fam_score >= best_score
            or len(fam_matches) > len(best_matches)
        )
        if use_family and fam_matches:
            exact_ids = {p.id for p in best_matches} if best_matches else set()
            exact_first = [p for p in fam_matches if p.id in exact_ids] if exact_ids else []
            if not exact_first and best_matches:
                exact_first = [p for p in best_matches if p.id in {x.id for x in fam_matches}]
                if not exact_first:
                    exact_first = list(best_matches)
            family_rest = [p for p in fam_matches if p.id not in {p.id for p in exact_first}]
            best_matches = exact_first + family_rest
            best_subset = fam_subset if fam_subset is not None else best_subset
            used_family = True

    if best_subset is None:
        if props and (not requested_core or requested_core <= frozenset({"location"})):
            selected = sort_by_query_relevance(props, query)[:limit]
            if selected:
                return selected, "closest", frozenset()
        return [], "exact", full

    selected = sort_by_query_relevance(best_matches, query)[:limit]
    all_exact_type = (not wants_type) or all(_property_type_exact(p, query) for p in selected)
    if best_subset == full and all_exact_type:
        mode = "exact"
    else:
        mode = "closest"
    return selected, mode, best_subset


async def _fetch_rental_pool(
    db: AsyncSession,
    *,
    location: str | None,
    include_unavailable: bool = False,
    pool_limit: int = 220,
) -> list[Property]:
    """Published rent/furnished inventory pool (no extra verification gate)."""
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
        q = q.where(
            Property.status.in_(
                [PropertyStatusEnum.PUBLISHED, PropertyStatusEnum.RENTED, PropertyStatusEnum.ARCHIVED]
            )
        )
    else:
        q = q.where(Property.status == PropertyStatusEnum.PUBLISHED)

    nids = await _neighborhood_ids(db, location)
    if nids:
        q = q.where(Property.neighborhood_id.in_(nids))

    # Prefer fresher inventory in the pool window.
    result = await db.execute(q.limit(pool_limit))
    return list(result.scalars().unique().all())


async def _filter_rental_properties(
    db: AsyncSession,
    query: dict[str, Any],
    *,
    limit: int,
    include_unavailable: bool = False,
    bedroom_mode: str = "exact",  # exact | min | any (legacy exact-path helper)
    include_bathrooms: bool = True,
    include_amenities: bool = True,
    include_budget: bool = True,
    include_property_type: bool = True,
    include_furnished: bool = True,
    location_override: str | None = None,
) -> list[Property]:
    """Strict SQL filter used by automation/quality scoring (exact eligibility)."""
    location = (
        location_override
        or (query.get("location") or query.get("location_slug") or "")
    ).lower() or None
    props = await _fetch_rental_pool(
        db,
        location=location,
        include_unavailable=include_unavailable,
        pool_limit=max(limit * 8, 80),
    )

    active: list[str] = []
    if location and location not in {"kigali", "all"}:
        active.append("location")
    if bedroom_mode != "any" and query.get("bedrooms") is not None:
        active.append("bedrooms")
    if include_budget and (
        query.get("max_price_usd", query.get("max_price")) is not None
        or query.get("min_price_usd", query.get("min_price")) is not None
    ):
        active.append("budget")
    if include_furnished and (
        query.get("furnished") is True
        or query.get("is_furnished") is True
        or query.get("furnished") is False
        or query.get("is_furnished") is False
    ):
        active.append("furnished")
    if include_property_type and (query.get("property_type") or query.get("property_type_slug")):
        active.append("property_type")
    if include_bathrooms and query.get("bathrooms") is not None:
        active.append("bathrooms")
    if include_amenities and (
        _amenity_flags_from_query(query)
        or query.get("amenity_slugs")
        or query.get("amenities")
    ):
        active.append("amenities")

    matched = [p for p in props if all(_criterion_holds(p, query, c) for c in active)]
    if bedroom_mode == "min" and query.get("bedrooms") is not None:
        beds = int(query["bedrooms"])
        matched = [
            p
            for p in matched
            if p.bedrooms is not None and int(p.bedrooms) >= beds
        ] if "bedrooms" not in active else [
            p
            for p in props
            if (p.bedrooms is not None and int(p.bedrooms) >= beds)
            and all(_criterion_holds(p, query, c) for c in active if c != "bedrooms")
        ]
    return sort_by_listing_freshness(matched)[:limit]


async def match_rentals_for_hub(
    db: AsyncSession,
    query: dict[str, Any],
    *,
    limit: int = 24,
    include_unavailable: bool = False,
    related_searches: list[dict[str, Any]] | None = None,
) -> tuple[list[Property], str]:
    """Match active published rentals for hub display via progressive combinations.

    Returns (properties, mode) where mode is ``exact`` or ``closest``.
    Published rent/furnished inventory counts as available — no extra verification flag.
    Property type is never allowed to empty a page when other criteria still match.

    When ``related_searches`` is provided (hub Related rental searches), candidates are
    ranked by keyword/intent relevance to those searches before the display cap.
    """
    loc = (query.get("location") or query.get("location_slug") or "").lower() or "kigali"
    pool_limit = max(limit * 20, 220)

    # Neighborhood pages: prefer local inventory, then widen to city for fallback combos.
    local_pool = await _fetch_rental_pool(
        db,
        location=None if loc in {"kigali", "all"} else loc,
        include_unavailable=include_unavailable,
        pool_limit=pool_limit,
    )
    if loc not in {"kigali", "all"}:
        city_pool = await _fetch_rental_pool(
            db,
            location="kigali",
            include_unavailable=include_unavailable,
            pool_limit=pool_limit,
        )
        by_id = {p.id: p for p in local_pool}
        for p in city_pool:
            by_id.setdefault(p.id, p)
        pool = list(by_id.values())
    else:
        pool = local_pool

    # Pull a wider eligible set, then re-rank by related-search keyword relevance when available.
    candidate_limit = max(limit * 4, limit, 36) if related_searches else limit
    selected, mode, _subset = select_progressive_match_group(
        pool, query, limit=candidate_limit
    )
    if related_searches:
        selected = sort_by_related_search_relevance(selected, related_searches)[:limit]
    elif len(selected) > limit:
        selected = selected[:limit]
    return selected, mode


async def match_verified_properties(
    db: AsyncSession,
    query: dict[str, Any],
    *,
    limit: int = 24,
    include_unavailable: bool = False,
    allow_closest: bool = False,
) -> list[Property]:
    """Return active published rent listings matching the query.

    When ``allow_closest`` is True (hub display), uses progressive matching.
    Automation/quality scoring should keep ``allow_closest=False`` (exact filters).
    """
    if allow_closest:
        props, _mode = await match_rentals_for_hub(
            db, query, limit=limit, include_unavailable=include_unavailable
        )
        return props
    return await _filter_rental_properties(
        db,
        query,
        limit=limit,
        include_unavailable=include_unavailable,
        bedroom_mode="exact",
        include_bathrooms=True,
        include_amenities=True,
    )


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
    elif prop.bedrooms is not None and prop.bedrooms == int(want_beds):
        score += 20

    ptype = (query.get("property_type") or "").lower()
    if not ptype:
        score += 5
    else:
        tokens = _property_type_tokens(prop)
        if _property_type_compatible(ptype, tokens, allow_family=False):
            score += 12
        elif _property_type_compatible(ptype, tokens, allow_family=True):
            # Villa/house/apartment family match — useful but below exact type.
            score += 8

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

    if getattr(prop, "status", None) == PropertyStatusEnum.PUBLISHED or (
        getattr(getattr(prop, "status", None), "value", None) == "published"
    ):
        score += 10
    if getattr(prop, "data_source_kind", None) == "verified_kigali_rent":
        score += 5

    # Light title keyword overlap with intent tokens (beds/type/area phrases).
    title = (getattr(prop, "title", None) or "").lower()
    tokens: list[str] = []
    if ptype:
        tokens.append(ptype)
        tokens.append(f"{ptype}s")
    if want_beds is not None:
        tokens.append(f"{int(want_beds)} bedroom")
        tokens.append(f"{int(want_beds)}-bedroom")
    if location and location not in {"kigali", "all"}:
        tokens.append(location.replace("-", " "))
    hit = sum(1 for t in tokens if t and t in title)
    score += min(8.0, hit * 2.5)

    verified = getattr(prop, "last_verified_at", None)
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


def answer_sentence(
    intent: SearchIntent,
    matches: list[Property],
    *,
    total_count: int | None = None,
    match_mode: str = "exact",
) -> str:
    h1 = intent.h1.rstrip(".")
    count = total_count if total_count is not None else len(matches)
    if match_mode == "closest" and matches:
        return (
            f"No exact matches for “{h1}” right now. "
            "Here are the closest available rentals."
        )
    if count <= 0 or not matches:
        if count <= 0:
            return (
                f"Kigali Rent currently has no rental properties matching “{h1}”. "
                "Browse the full catalogue or related searches below."
            )
        return f"Kigali Rent currently has {count} available {'rental' if count == 1 else 'rentals'} for “{h1}”."
    prices = [effective_usd_price(p) for p in matches]
    prices = [p for p in prices if p is not None]
    if prices:
        lo, hi = min(prices), max(prices)
        if lo == hi:
            price_bit = f"priced at ${lo:,.0f}/month"
        else:
            price_bit = f"ranging from ${lo:,.0f} to ${hi:,.0f}/month"
        return (
            f"Kigali Rent currently has {count} available "
            f"{'rental' if count == 1 else 'rentals'} for “{h1}”, {price_bit}."
        )
    return f"Kigali Rent currently has {count} available {'rental' if count == 1 else 'rentals'} for “{h1}”."
