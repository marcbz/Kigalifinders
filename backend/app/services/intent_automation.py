"""Inventory-driven search intent discovery and automation pipeline."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    ListingType,
    Neighborhood,
    Property,
    PropertyStatusEnum,
    PropertyType,
    RentalObservation,
    SearchIndexStatus,
    SearchIntent,
    SearchLandingRelation,
)
from app.services.fx import effective_usd_price
from app.services.intent_config import IntentAutomationConfig, load_automation_config
from app.services.intent_copy import (
    canonical_query_hash,
    generate_copy,
    intent_slug_from_query,
    location_slug_from_query,
    normalize_query,
)
from app.services.search_intent import (
    build_path,
    get_market_snapshot_for_query,
    match_verified_properties,
    quality_score_for_intent,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def discover_price_bands(usd_prices: list[float], max_bands: int = 4) -> list[int]:
    """Derive a few useful USD under-X thresholds from actual prices. Never invent volume."""
    vals = sorted(p for p in usd_prices if p and p > 0)
    if len(vals) < 3:
        return []
    # Quantile-ish cut points, snapped to round hundreds
    anchors = []
    for frac in (0.35, 0.55, 0.75, 0.9):
        idx = min(len(vals) - 1, max(0, int(len(vals) * frac)))
        raw = vals[idx]
        snapped = int(round(raw / 100.0) * 100)
        if snapped < 300:
            snapped = 300
        if snapped not in anchors:
            anchors.append(snapped)
    # Prefer ascending unique under thresholds that cover meaningful share
    out = []
    for a in sorted(anchors):
        below = sum(1 for v in vals if v <= a)
        if below >= 2 and a not in out:
            out.append(a)
        if len(out) >= max_bands:
            break
    return out


def opportunity_score(
    *,
    verified: int,
    observations: int,
    freshness: str,
    specificity: float,
    uniqueness: float,
    gsc_impressions: int | None = None,
) -> float:
    score = 0.0
    score += min(35.0, verified * 10.0)
    score += min(20.0, observations * 1.5)
    if freshness == "fresh":
        score += 15
    elif freshness == "aging":
        score += 8
    score += min(15.0, specificity)
    score += min(15.0, uniqueness)
    if gsc_impressions is not None and gsc_impressions > 0:
        # Real Search Console signal only — never fabricated
        score += min(15.0, gsc_impressions / 20.0)
    return min(100.0, round(score, 1))


def compute_freshness(last_verified_dates: list[datetime | None], cfg: IntentAutomationConfig) -> str:
    dates = [d for d in last_verified_dates if d]
    if not dates:
        return "unknown"
    newest = max(dates)
    if newest.tzinfo is None:
        newest = newest.replace(tzinfo=timezone.utc)
    age = (_now() - newest).days
    if age <= cfg.freshness_fresh_days:
        return "fresh"
    if age <= cfg.freshness_aging_days:
        return "aging"
    return "stale"


def specificity_score(query: dict[str, Any]) -> float:
    q = normalize_query(query)
    s = 0.0
    if q.get("location") and q["location"] != "kigali":
        s += 4
    if q.get("property_type"):
        s += 3
    if q.get("bedrooms") is not None:
        s += 3
    if q.get("furnished") is not None:
        s += 2
    if q.get("amenities"):
        s += 2
    if q.get("max_price_usd") is not None:
        s += 2
    return s


async def count_observations(db: AsyncSession, query: dict[str, Any]) -> int:
    q = normalize_query(query)
    stmt = select(func.count()).select_from(RentalObservation).where(
        RentalObservation.observation_status.in_(["active_observed", "price_changed"]),
        RentalObservation.usd_price.is_not(None),
    )
    if q["location"] not in {"kigali", "all"}:
        stmt = stmt.where(RentalObservation.neighborhood_slug == q["location"])
    if q.get("bedrooms") is not None:
        stmt = stmt.where(RentalObservation.bedrooms == int(q["bedrooms"]))
    if q.get("property_type"):
        stmt = stmt.where(RentalObservation.property_type.ilike(f"%{q['property_type']}%"))
    if q.get("furnished") is True:
        stmt = stmt.where(RentalObservation.is_furnished.is_(True))
    if q.get("max_price_usd") is not None:
        stmt = stmt.where(RentalObservation.usd_price <= float(q["max_price_usd"]))
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def _load_published_rentals(db: AsyncSession) -> list[Property]:
    result = await db.execute(
        select(Property)
        .options(
            selectinload(Property.neighborhood),
            selectinload(Property.property_type),
            selectinload(Property.amenities),
        )
        .where(
            Property.status == PropertyStatusEnum.PUBLISHED,
            Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]),
        )
    )
    return list(result.scalars().unique().all())


def _candidate_queries_from_inventory(
    props: list[Property],
    cfg: IntentAutomationConfig,
) -> list[dict[str, Any]]:
    """Build a bounded set of meaningful queries from actual inventory — not full combinatorics."""
    by_loc: dict[str, list[Property]] = defaultdict(list)
    for p in props:
        loc = p.neighborhood.slug if p.neighborhood else "kigali"
        by_loc[loc].append(p)
        by_loc["kigali"].append(p)

    candidates: list[dict[str, Any]] = []
    seen_hashes: set[str] = set()

    def add(query: dict[str, Any]) -> None:
        q = normalize_query(query)
        h = canonical_query_hash(q)
        if h in seen_hashes:
            return
        seen_hashes.add(h)
        candidates.append(q)

    for loc, items in by_loc.items():
        if loc != "kigali" and len(items) < cfg.min_verified_for_discover:
            continue

        type_counts: Counter[str] = Counter()
        bed_counts: Counter[int] = Counter()
        furnished_n = 0
        pool_n = 0
        prices: list[float] = []
        for p in items:
            slug = p.property_type.slug if p.property_type else None
            if slug:
                type_counts[slug] += 1
            if p.bedrooms:
                bed_counts[min(int(p.bedrooms), 4) if int(p.bedrooms) >= 4 else int(p.bedrooms)] += 1
                if int(p.bedrooms) >= 4:
                    bed_counts[4] += 1
            if p.is_furnished or p.listing_type == ListingType.FURNISHED:
                furnished_n += 1
            if p.has_pool:
                pool_n += 1
            usd = effective_usd_price(p)
            if usd:
                prices.append(usd)

        # Location + type
        for ptype, cnt in type_counts.items():
            if cnt < cfg.min_verified_for_discover:
                continue
            add({"location": loc, "property_type": ptype})

            # Location + type + bedrooms
            for beds in cfg.bedroom_levels:
                bed_items = [p for p in items if p.bedrooms and int(p.bedrooms) >= beds and (
                    (p.property_type and p.property_type.slug == ptype) or False
                )]
                # Also match property_type_ids loosely via type_counts path — filter by type name
                bed_items = [
                    p for p in items
                    if p.bedrooms and int(p.bedrooms) >= beds
                    and p.property_type and p.property_type.slug == ptype
                ]
                if len(bed_items) < cfg.min_verified_for_discover:
                    continue
                add({"location": loc, "property_type": ptype, "bedrooms": beds})

                furnished_items = [p for p in bed_items if p.is_furnished or p.listing_type == ListingType.FURNISHED]
                if len(furnished_items) >= cfg.min_verified_for_discover:
                    add({"location": loc, "property_type": ptype, "bedrooms": beds, "furnished": True})
                    pool_items = [p for p in furnished_items if p.has_pool]
                    if len(pool_items) >= cfg.min_verified_for_discover and cfg.max_amenities_per_location >= 1:
                        add({
                            "location": loc,
                            "property_type": ptype,
                            "bedrooms": beds,
                            "furnished": True,
                            "amenities": ["swimming_pool"],
                        })

            # Furnished type at location
            furn_type = [
                p for p in items
                if p.property_type and p.property_type.slug == ptype
                and (p.is_furnished or p.listing_type == ListingType.FURNISHED)
            ]
            if len(furn_type) >= cfg.min_verified_for_discover:
                add({"location": loc, "property_type": ptype, "furnished": True})

            # Pool at location + type
            pool_type = [p for p in items if p.property_type and p.property_type.slug == ptype and p.has_pool]
            if len(pool_type) >= cfg.min_verified_for_discover:
                add({"location": loc, "property_type": ptype, "amenities": ["swimming_pool"]})

            # Price bands from this slice
            type_prices = [
                effective_usd_price(p)
                for p in items
                if p.property_type and p.property_type.slug == ptype
            ]
            type_prices = [x for x in type_prices if x]
            for band in discover_price_bands(type_prices):
                under = [
                    p for p in items
                    if p.property_type and p.property_type.slug == ptype
                    and (effective_usd_price(p) or 0) <= band
                ]
                if len(under) >= cfg.min_verified_for_discover:
                    add({"location": loc, "property_type": ptype, "max_price_usd": band})
                    for beds in cfg.bedroom_levels:
                        under_beds = [p for p in under if p.bedrooms and int(p.bedrooms) >= beds]
                        if len(under_beds) >= cfg.min_verified_for_discover:
                            add({
                                "location": loc,
                                "property_type": ptype,
                                "bedrooms": beds,
                                "max_price_usd": band,
                            })

    return candidates[: cfg.max_discovered_per_run * 2]


async def _candidate_queries_from_observations(
    db: AsyncSession,
    cfg: IntentAutomationConfig,
) -> list[dict[str, Any]]:
    """Discover intents supported by external observations (never treated as verified inventory)."""
    result = await db.execute(
        select(RentalObservation)
        .where(
            RentalObservation.observation_status.in_(["active_observed", "price_changed"]),
            RentalObservation.usd_price.is_not(None),
            RentalObservation.neighborhood_slug.is_not(None),
        )
        .limit(5000)
    )
    rows = list(result.scalars().all())
    by_loc: dict[str, list] = defaultdict(list)
    for o in rows:
        by_loc[o.neighborhood_slug or "kigali"].append(o)
        by_loc["kigali"].append(o)

    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(query: dict[str, Any]) -> None:
        q = normalize_query(query)
        h = canonical_query_hash(q)
        if h in seen:
            return
        seen.add(h)
        candidates.append(q)

    for loc, items in by_loc.items():
        if len(items) < cfg.min_observations_for_research_value and loc != "kigali":
            continue
        type_counts: Counter[str] = Counter()
        for o in items:
            if o.property_type:
                slug = str(o.property_type).lower().replace(" ", "-")
                if "apartment" in slug:
                    type_counts["apartment"] += 1
                elif "house" in slug:
                    type_counts["house"] += 1
        for ptype, cnt in type_counts.items():
            if cnt < max(3, cfg.min_observations_for_research_value // 2):
                continue
            add({"location": loc, "property_type": ptype})
            for beds in cfg.bedroom_levels:
                bed_items = [o for o in items if o.bedrooms and int(o.bedrooms) >= beds]
                if len(bed_items) >= 3:
                    add({"location": loc, "property_type": ptype, "bedrooms": beds})
    return candidates[: cfg.max_discovered_per_run]


async def upsert_discovered_intent(
    db: AsyncSession,
    query: dict[str, Any],
    *,
    source: str,
    cfg: IntentAutomationConfig,
) -> SearchIntent | None:
    q = normalize_query(query)
    location = location_slug_from_query(q)
    intent_slug = intent_slug_from_query(q)
    path = build_path(location, intent_slug)
    qhash = canonical_query_hash(q)
    copy = generate_copy(q)

    matches = await match_verified_properties(db, q, limit=50)
    obs_count = await count_observations(db, q)
    if len(matches) < cfg.min_verified_for_discover and obs_count < cfg.min_observations_for_research_value:
        return None

    freshness = compute_freshness([m.last_verified_at for m in matches], cfg)
    opp = opportunity_score(
        verified=len(matches),
        observations=obs_count,
        freshness=freshness,
        specificity=specificity_score(q),
        uniqueness=8.0 if location != "kigali" else 4.0,
    )
    snap = await get_market_snapshot_for_query(db, q)
    quality = quality_score_for_intent(
        len(matches),
        has_price_stats=snap is not None or len(matches) >= 3,
        location_known=True,
        unique_copy=True,
    )

    existing = await db.execute(
        select(SearchIntent).where(
            (SearchIntent.path == path) | (SearchIntent.canonical_query_hash == qhash)
        ).limit(1)
    )
    intent = existing.scalar_one_or_none()

    if intent and intent.automation_disabled:
        # Still refresh metrics but do not change status/copy
        intent.match_count = len(matches)
        intent.matching_observation_count = obs_count
        intent.opportunity_score = opp
        intent.quality_score = quality
        intent.data_freshness = freshness
        intent.last_calculated_at = _now()
        return intent

    if not intent:
        status = SearchIndexStatus.DISCOVERED.value
        reason = "Auto-discovered from inventory"
        if len(matches) >= cfg.min_verified_for_draft and opp >= cfg.min_opportunity_for_draft:
            status = SearchIndexStatus.DRAFT.value
            reason = "Promoted to draft: sufficient inventory and opportunity score"
        intent = SearchIntent(
            location_slug=location,
            intent_slug=intent_slug,
            path=path,
            query=q,
            title=copy["title"],
            h1=copy["h1"],
            meta_description=copy["meta_description"],
            index_status=status,
            source=source,
            status_reason=reason,
            canonical_query_hash=qhash,
            is_enabled=True,
        )
        db.add(intent)
        intent.last_content_change_at = _now()
    else:
        if not intent.locked_by_admin:
            # Refresh generated copy unless admin locked
            if intent.source in {"discovered", "seed"} or source == "discovered":
                if intent.title != copy["title"] or intent.h1 != copy["h1"]:
                    intent.title = copy["title"]
                    intent.h1 = copy["h1"]
                    intent.meta_description = copy["meta_description"]
                    intent.last_content_change_at = _now()
            intent.query = q
            intent.canonical_query_hash = qhash
            if intent.source == "manual" and source == "discovered":
                pass  # keep manual source
            elif intent.source != "seed":
                intent.source = intent.source or source

        # Soft promote discovered → draft when ready (never override DISABLED / locked)
        if (
            not intent.locked_by_admin
            and intent.index_status == SearchIndexStatus.DISCOVERED.value
            and len(matches) >= cfg.min_verified_for_draft
            and opp >= cfg.min_opportunity_for_draft
        ):
            intent.index_status = SearchIndexStatus.DRAFT.value
            intent.status_reason = "Auto-promoted to draft"

    intent.match_count = len(matches)
    intent.matching_observation_count = obs_count
    intent.opportunity_score = opp
    intent.quality_score = quality
    intent.data_freshness = freshness
    intent.last_calculated_at = _now()
    intent.last_built_at = _now()
    return intent


async def apply_index_rules(db: AsyncSession, cfg: IntentAutomationConfig) -> dict[str, int]:
    """Promote/demote based on strict gates. Respects admin locks."""
    promoted = demoted = 0
    result = await db.execute(
        select(SearchIntent).where(
            SearchIntent.is_enabled == True,  # noqa: E712
            SearchIntent.automation_disabled == False,  # noqa: E712
            SearchIntent.locked_by_admin == False,  # noqa: E712
            SearchIntent.index_status.in_(
                [
                    SearchIndexStatus.DRAFT.value,
                    SearchIndexStatus.INDEXABLE.value,
                    SearchIndexStatus.NOINDEX.value,
                    SearchIndexStatus.DISCOVERED.value,
                ]
            ),
        )
    )
    intents = list(result.scalars().all())
    indexable_count = sum(1 for i in intents if i.index_status == SearchIndexStatus.INDEXABLE.value)

    # Near-duplicate: same location+beds+type, close price bands — keep higher opportunity
    by_core: dict[tuple, list[SearchIntent]] = defaultdict(list)
    for intent in intents:
        q = normalize_query(intent.query or {})
        key = (q.get("location"), q.get("property_type"), q.get("bedrooms"), q.get("furnished"), tuple(q.get("amenities") or []))
        if q.get("max_price_usd") is not None:
            by_core[key].append(intent)

    near_dupe_losers: set[UUID] = set()
    for group in by_core.values():
        priced = [i for i in group if normalize_query(i.query).get("max_price_usd") is not None]
        priced.sort(key=lambda i: (-i.opportunity_score, normalize_query(i.query).get("max_price_usd") or 0))
        for i, a in enumerate(priced):
            for b in priced[i + 1 :]:
                pa = float(normalize_query(a.query).get("max_price_usd") or 0)
                pb = float(normalize_query(b.query).get("max_price_usd") or 0)
                if abs(pa - pb) < cfg.near_duplicate_price_band_gap:
                    near_dupe_losers.add(b.id)

    for intent in intents:
        if intent.id in near_dupe_losers and intent.index_status == SearchIndexStatus.INDEXABLE.value:
            intent.index_status = SearchIndexStatus.NOINDEX.value
            intent.status_reason = "Near-duplicate price band; kept higher-opportunity sibling"
            demoted += 1
            continue

        passes = (
            cfg.allow_auto_index
            and intent.match_count >= cfg.min_verified_for_index
            and intent.opportunity_score >= cfg.min_opportunity_for_index
            and intent.quality_score >= cfg.min_quality_for_index
            and intent.data_freshness in {"fresh", "aging", "unknown"}
            and bool(intent.title and intent.h1 and intent.meta_description)
            and intent.id not in near_dupe_losers
        )
        # Research-only path: fewer verified but strong observations
        research_passes = (
            cfg.allow_auto_index
            and intent.match_count >= 1
            and intent.matching_observation_count >= cfg.min_observations_for_research_value
            and intent.opportunity_score >= cfg.min_opportunity_for_index
            and intent.quality_score >= cfg.min_quality_for_index
            and intent.id not in near_dupe_losers
        )

        if intent.index_status in {SearchIndexStatus.DRAFT.value, SearchIndexStatus.NOINDEX.value, SearchIndexStatus.DISCOVERED.value}:
            if (passes or research_passes) and indexable_count < cfg.max_auto_indexable:
                intent.index_status = SearchIndexStatus.INDEXABLE.value
                intent.status_reason = "Auto-indexable: passed quality and opportunity gates"
                promoted += 1
                indexable_count += 1
        elif intent.index_status == SearchIndexStatus.INDEXABLE.value:
            if not passes and not research_passes:
                # Keep URL if temporarily zero matches but still useful research; prefer noindex if thin
                if intent.match_count == 0 and intent.matching_observation_count < cfg.min_observations_for_research_value:
                    intent.index_status = SearchIndexStatus.NOINDEX.value
                    intent.status_reason = "Demoted: insufficient verified inventory and research data"
                    demoted += 1
                elif intent.data_freshness == "stale" and intent.match_count < cfg.min_verified_for_index:
                    intent.index_status = SearchIndexStatus.NOINDEX.value
                    intent.status_reason = "Demoted: stale data"
                    demoted += 1

    await db.flush()
    return {"promoted": promoted, "demoted": demoted}


async def rebuild_related_for_intent(db: AsyncSession, intent: SearchIntent, limit: int = 6) -> int:
    """Create related intent candidates and link them."""
    q = normalize_query(intent.query or {})
    related_queries: list[dict[str, Any]] = []
    base = {"location": q["location"], "property_type": q.get("property_type")}
    if q.get("bedrooms") is not None and q.get("property_type"):
        related_queries.append({**base, "bedrooms": q["bedrooms"]})
    if q.get("furnished") and q.get("property_type"):
        related_queries.append({**base, "furnished": True})
    if "swimming_pool" in (q.get("amenities") or []) and q.get("property_type"):
        related_queries.append({**base, "amenities": ["swimming_pool"]})
    if q.get("max_price_usd") is not None and q.get("property_type"):
        related_queries.append({"location": "kigali", "property_type": q["property_type"], "max_price_usd": q["max_price_usd"]})
        if q.get("bedrooms") is not None:
            related_queries.append({
                "location": "kigali",
                "property_type": q["property_type"],
                "bedrooms": q["bedrooms"],
                "max_price_usd": q["max_price_usd"],
            })
    if q["location"] != "kigali" and q.get("property_type"):
        related_queries.append({"location": "kigali", "property_type": q["property_type"]})

    cfg = await load_automation_config(db)
    linked = 0
    sort_order = 0
    await db.execute(delete(SearchLandingRelation).where(SearchLandingRelation.from_intent_id == intent.id))
    for rq in related_queries:
        if canonical_query_hash(rq) == canonical_query_hash(q):
            continue
        rel = await upsert_discovered_intent(db, rq, source="discovered", cfg=cfg)
        if not rel or rel.id == intent.id:
            continue
        await db.flush()
        db.add(
            SearchLandingRelation(
                from_intent_id=intent.id,
                to_intent_id=rel.id,
                relation_type="related",
                sort_order=sort_order,
            )
        )
        sort_order += 1
        linked += 1
        if linked >= limit:
            break
    await db.flush()
    return linked


async def discover_intents(db: AsyncSession, *, deep: bool = False) -> dict[str, Any]:
    from dataclasses import replace

    cfg = await load_automation_config(db)
    if deep:
        cfg = replace(cfg, max_discovered_per_run=cfg.max_discovered_per_run * 2)
    props = await _load_published_rentals(db)
    candidates = _candidate_queries_from_inventory(props, cfg)
    obs_candidates = await _candidate_queries_from_observations(db, cfg)
    seen = {canonical_query_hash(c) for c in candidates}
    for c in obs_candidates:
        h = canonical_query_hash(c)
        if h not in seen:
            candidates.append(c)
            seen.add(h)
    created = updated = skipped = 0
    for query in candidates[: cfg.max_discovered_per_run]:
        before = await db.execute(
            select(SearchIntent.id).where(SearchIntent.canonical_query_hash == canonical_query_hash(query))
        )
        existed = before.scalar_one_or_none() is not None
        intent = await upsert_discovered_intent(db, query, source="discovered", cfg=cfg)
        if intent is None:
            skipped += 1
            continue
        if existed:
            updated += 1
        else:
            created += 1
    await db.flush()
    return {
        "candidates": len(candidates),
        "from_observations": len(obs_candidates),
        "created": created,
        "updated": updated,
        "skipped": skipped,
    }


async def recalculate_all_intent_metrics(db: AsyncSession) -> int:
    cfg = await load_automation_config(db)
    result = await db.execute(select(SearchIntent).where(SearchIntent.is_enabled == True))  # noqa: E712
    n = 0
    for intent in result.scalars().all():
        await upsert_discovered_intent(db, intent.query or {}, source=intent.source or "manual", cfg=cfg)
        n += 1
    return n


async def refresh_intents_for_property_facets(
    db: AsyncSession,
    *,
    location_slug: str | None,
    bedrooms: int | None,
    property_type_slug: str | None,
) -> int:
    """Targeted recalculation — avoid rebuilding every intent."""
    cfg = await load_automation_config(db)
    stmt = select(SearchIntent).where(SearchIntent.is_enabled == True)  # noqa: E712
    intents = list((await db.execute(stmt)).scalars().all())
    touched = 0
    for intent in intents:
        q = normalize_query(intent.query or {})
        if location_slug and q.get("location") not in {location_slug, "kigali"}:
            continue
        if bedrooms is not None and q.get("bedrooms") is not None and int(q["bedrooms"]) not in {bedrooms, min(bedrooms, 4)}:
            # Still refresh broader location intents
            if q.get("bedrooms") and int(q["bedrooms"]) > bedrooms:
                pass
            elif q.get("bedrooms"):
                continue
        if property_type_slug and q.get("property_type") and q["property_type"] != property_type_slug:
            continue
        await upsert_discovered_intent(db, intent.query or {}, source=intent.source or "discovered", cfg=cfg)
        touched += 1
    return touched


async def run_daily_automation(db: AsyncSession) -> dict[str, Any]:
    from app.services.research import rebuild_observation_snapshots, rebuild_verified_snapshots

    v = await rebuild_verified_snapshots(db)
    o = await rebuild_observation_snapshots(db)
    disc = await discover_intents(db, deep=False)
    recalculated = await recalculate_all_intent_metrics(db)
    index_stats = await apply_index_rules(db, await load_automation_config(db))

    # Related searches for top opportunities
    top = await db.execute(
        select(SearchIntent)
        .where(
            SearchIntent.is_enabled == True,  # noqa: E712
            SearchIntent.index_status.in_(
                [SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.DRAFT.value]
            ),
        )
        .order_by(SearchIntent.opportunity_score.desc())
        .limit(40)
    )
    related_links = 0
    for intent in top.scalars().all():
        related_links += await rebuild_related_for_intent(db, intent)

    await db.commit()
    return {
        "verified_snapshots": v,
        "observation_snapshots": o,
        "discovery": disc,
        "recalculated": recalculated,
        "index_rules": index_stats,
        "related_links": related_links,
    }


async def run_weekly_audit(db: AsyncSession) -> dict[str, Any]:
    cfg = await load_automation_config(db)
    disc = await discover_intents(db, deep=True)
    index_stats = await apply_index_rules(db, cfg)
    # Mark stale
    stale = 0
    result = await db.execute(select(SearchIntent).where(SearchIntent.is_enabled == True))  # noqa: E712
    for intent in result.scalars().all():
        if intent.locked_by_admin or intent.automation_disabled:
            continue
        if intent.data_freshness == "stale" and intent.index_status == SearchIndexStatus.INDEXABLE.value:
            if intent.match_count < cfg.min_verified_for_index:
                intent.index_status = SearchIndexStatus.NOINDEX.value
                intent.status_reason = "Weekly audit: stale thin page"
                stale += 1
    await db.commit()
    return {"discovery": disc, "index_rules": index_stats, "stale_demoted": stale}
