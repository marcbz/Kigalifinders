"""Market research aggregates from verified inventory and observations."""

from __future__ import annotations

import calendar
import statistics
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    ListingType,
    MarketDataKind,
    MarketStatSnapshot,
    Property,
    PropertyStatusEnum,
    RentalObservation,
)
from app.services.fx import effective_usd_price

MIN_SAMPLE = 3


def _percentile(sorted_vals: list[float], p: float) -> float | None:
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * p
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    if f == c:
        return sorted_vals[f]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def _stats(values: list[float]) -> dict:
    vals = sorted(v for v in values if v is not None)
    if not vals:
        return {}
    return {
        "sample_size": len(vals),
        "median_usd": round(statistics.median(vals), 2),
        "p25_usd": round(_percentile(vals, 0.25) or 0, 2),
        "p75_usd": round(_percentile(vals, 0.75) or 0, 2),
        "min_usd": round(min(vals), 2),
        "max_usd": round(max(vals), 2),
    }


async def rebuild_verified_snapshots(db: AsyncSession, period_end: date | None = None) -> int:
    """Aggregate published rent listings into market_stat_snapshots."""
    period_end = period_end or date.today()
    period_start = period_end.replace(day=1)

    result = await db.execute(
        select(Property)
        .options(selectinload(Property.neighborhood), selectinload(Property.amenities))
        .where(
            Property.status == PropertyStatusEnum.PUBLISHED,
            Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]),
        )
    )
    props = list(result.scalars().all())

    buckets: dict[tuple, list[tuple[float, list[str]]]] = defaultdict(list)
    for p in props:
        usd = effective_usd_price(p)
        if usd is None:
            continue
        loc = p.neighborhood.slug if p.neighborhood else "kigali"
        loc_name = p.neighborhood.name if p.neighborhood else "Kigali"
        amenities = [a.slug for a in (p.amenities or [])]
        if p.has_pool and "pool" not in amenities:
            amenities.append("pool")
        keys = [
            (loc, loc_name, None, None, None),
            (loc, loc_name, None, p.bedrooms, None),
            (loc, loc_name, None, p.bedrooms, p.is_furnished),
            ("kigali", "Kigali", None, p.bedrooms, None),
            ("kigali", "Kigali", None, None, None),
        ]
        for key in keys:
            buckets[key].append((usd, amenities))

    # Clear existing verified snapshots for this period
    existing = await db.execute(
        select(MarketStatSnapshot).where(
            MarketStatSnapshot.period_end == period_end,
            MarketStatSnapshot.data_kind == MarketDataKind.VERIFIED_KIGALI_RENT.value,
        )
    )
    for row in existing.scalars().all():
        await db.delete(row)
    await db.flush()

    created = 0
    for (loc, loc_name, ptype, beds, furnished), rows in buckets.items():
        prices = [r[0] for r in rows]
        if len(prices) < MIN_SAMPLE and loc != "kigali":
            continue
        if len(prices) < 1:
            continue
        amenity_counter: Counter[str] = Counter()
        for _, ams in rows:
            amenity_counter.update(ams)
        common = [a for a, _ in amenity_counter.most_common(8)]
        st = _stats(prices)
        if not st:
            continue
        db.add(
            MarketStatSnapshot(
                period_start=period_start,
                period_end=period_end,
                granularity="month",
                location_slug=loc,
                location_name=loc_name,
                property_type=ptype,
                bedrooms=beds,
                is_furnished=furnished,
                data_kind=MarketDataKind.VERIFIED_KIGALI_RENT.value,
                sample_size=st["sample_size"],
                median_usd=st["median_usd"],
                p25_usd=st["p25_usd"],
                p75_usd=st["p75_usd"],
                min_usd=st["min_usd"],
                max_usd=st["max_usd"],
                common_amenities=common,
            )
        )
        created += 1
    await db.flush()
    return created


async def rebuild_observation_snapshots(db: AsyncSession, period_end: date | None = None) -> int:
    """Rebuild external-observation market snapshots from imported rows.

    Creates overall Kigali + bedroom + neighborhood buckets (same shape as verified),
    for each calendar month that has observations, so charts/trends update after CSV import.
    Never mixes into verified inventory.
    """
    period_end = period_end or date.today()

    result = await db.execute(
        select(RentalObservation).where(
            RentalObservation.observation_status.in_(["active_observed", "price_changed"]),
            RentalObservation.usd_price.is_not(None),
        )
    )
    rows = list(result.scalars().all())

    existing = await db.execute(
        select(MarketStatSnapshot).where(
            MarketStatSnapshot.data_kind == MarketDataKind.MARKET_OBSERVATION.value,
        )
    )
    for row in existing.scalars().all():
        await db.delete(row)
    await db.flush()

    # Group by calendar month of observed_at
    by_month: dict[tuple[int, int], list[RentalObservation]] = defaultdict(list)
    for o in rows:
        obs_day = (o.observed_at or datetime.now(timezone.utc)).date()
        by_month[(obs_day.year, obs_day.month)].append(o)

    # Rolling current-period view includes ALL active observations so fresh imports appear immediately
    current_key = (period_end.year, period_end.month)
    if rows:
        by_month[current_key] = list(rows)

    created = 0
    for (year, month), month_rows in by_month.items():
        month_start = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        p_end = period_end if (year, month) == current_key else date(year, month, last_day)

        buckets: dict[tuple, list[float]] = defaultdict(list)
        for o in month_rows:
            usd = float(o.usd_price)
            loc = o.neighborhood_slug or "kigali"
            loc_name = o.neighborhood or loc.replace("-", " ").title()
            for key in (
                (loc, loc_name, None, None, None),
                (loc, loc_name, None, o.bedrooms, None),
                ("kigali", "Kigali", None, None, None),
                ("kigali", "Kigali", None, o.bedrooms, None),
            ):
                buckets[key].append(usd)

        for (loc, loc_name, ptype, beds, furnished), prices in buckets.items():
            if len(prices) < 1:
                continue
            st = _stats(prices)
            db.add(
                MarketStatSnapshot(
                    period_start=month_start,
                    period_end=p_end,
                    granularity="month",
                    location_slug=loc,
                    location_name=loc_name or loc.title(),
                    property_type=ptype,
                    bedrooms=beds,
                    is_furnished=furnished,
                    data_kind=MarketDataKind.MARKET_OBSERVATION.value,
                    sample_size=st["sample_size"],
                    median_usd=st["median_usd"],
                    p25_usd=st["p25_usd"],
                    p75_usd=st["p75_usd"],
                    min_usd=st["min_usd"],
                    max_usd=st["max_usd"],
                    common_amenities=None,
                )
            )
            created += 1

    await db.flush()
    return created


async def observation_activity_series(db: AsyncSession, months: int = 12) -> list[dict]:
    """Count of observations over time — not total market supply."""
    result = await db.execute(
        select(RentalObservation.observed_at, RentalObservation.id).where(
            RentalObservation.observation_status != "invalid"
        )
    )
    counts: Counter[str] = Counter()
    for observed_at, _ in result.all():
        if not observed_at:
            continue
        key = observed_at.strftime("%Y-%m")
        counts[key] += 1
    keys = sorted(counts.keys())[-months:]
    return [{"month": k, "observations": counts[k]} for k in keys]


async def research_chart_payload(db: AsyncSession) -> dict:
    """Aggregated chart series from snapshots + observations — for public research UI."""
    verified_overall = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.data_kind == MarketDataKind.VERIFIED_KIGALI_RENT.value,
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.property_type.is_(None),
        )
        .order_by(MarketStatSnapshot.period_end.desc())
        .limit(1)
    )
    observed_overall = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.data_kind == MarketDataKind.MARKET_OBSERVATION.value,
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.property_type.is_(None),
        )
        .order_by(MarketStatSnapshot.period_end.desc())
        .limit(1)
    )
    v = verified_overall.scalar_one_or_none()
    o = observed_overall.scalar_one_or_none()

    async def _by_bedroom(kind: str) -> list[dict]:
        beds = await db.execute(
            select(MarketStatSnapshot)
            .where(
                MarketStatSnapshot.data_kind == kind,
                MarketStatSnapshot.location_slug == "kigali",
                MarketStatSnapshot.bedrooms.is_not(None),
                MarketStatSnapshot.property_type.is_(None),
            )
            .order_by(MarketStatSnapshot.period_end.desc(), MarketStatSnapshot.bedrooms.asc())
            .limit(40)
        )
        seen: set[int] = set()
        out = []
        for row in beds.scalars().all():
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
                    "data_kind": row.data_kind,
                }
            )
        return out

    async def _by_neighborhood(kind: str, min_sample: int = 1) -> list[dict]:
        neighborhoods = await db.execute(
            select(MarketStatSnapshot)
            .where(
                MarketStatSnapshot.data_kind == kind,
                MarketStatSnapshot.location_slug != "kigali",
                MarketStatSnapshot.bedrooms.is_(None),
                MarketStatSnapshot.property_type.is_(None),
                MarketStatSnapshot.sample_size >= min_sample,
            )
            .order_by(MarketStatSnapshot.period_end.desc(), MarketStatSnapshot.median_usd.desc())
            .limit(60)
        )
        seen: set[str] = set()
        out = []
        for row in neighborhoods.scalars().all():
            if row.location_slug in seen:
                continue
            seen.add(row.location_slug)
            out.append(
                {
                    "location_slug": row.location_slug,
                    "label": row.location_name or row.location_slug,
                    "median_usd": row.median_usd,
                    "p25_usd": row.p25_usd,
                    "p75_usd": row.p75_usd,
                    "sample_size": row.sample_size,
                    "data_kind": row.data_kind,
                }
            )
        return out

    by_bedroom = await _by_bedroom(MarketDataKind.VERIFIED_KIGALI_RENT.value)
    by_bedroom_external = await _by_bedroom(MarketDataKind.MARKET_OBSERVATION.value)
    by_neighborhood = await _by_neighborhood(MarketDataKind.VERIFIED_KIGALI_RENT.value, MIN_SAMPLE)
    by_neighborhood_external = await _by_neighborhood(MarketDataKind.MARKET_OBSERVATION.value, 1)

    trend = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.property_type.is_(None),
            MarketStatSnapshot.data_kind == MarketDataKind.VERIFIED_KIGALI_RENT.value,
        )
        .order_by(MarketStatSnapshot.period_end.asc())
        .limit(36)
    )
    trend_rows = list(trend.scalars().all())

    trend_ext = await db.execute(
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.location_slug == "kigali",
            MarketStatSnapshot.bedrooms.is_(None),
            MarketStatSnapshot.property_type.is_(None),
            MarketStatSnapshot.data_kind == MarketDataKind.MARKET_OBSERVATION.value,
        )
        .order_by(MarketStatSnapshot.period_end.asc())
        .limit(36)
    )
    trend_ext_rows = list(trend_ext.scalars().all())
    # Prefer distinct calendar months for external trend (skip duplicate rolling points sharing same month if any)
    seen_months: set[str] = set()
    trend_external = []
    for r in trend_ext_rows:
        key = r.period_end.strftime("%Y-%m")
        if key in seen_months:
            continue
        seen_months.add(key)
        trend_external.append(
            {
                "period_end": r.period_end.isoformat(),
                "median_usd": r.median_usd,
                "sample_size": r.sample_size,
                "data_kind": r.data_kind,
            }
        )

    activity = await observation_activity_series(db)
    from sqlalchemy import func

    obs_count = await db.execute(
        select(func.count())
        .select_from(RentalObservation)
        .where(
            RentalObservation.observation_status.in_(["active_observed", "price_changed"]),
            RentalObservation.usd_price.is_not(None),
        )
    )
    external_active_count = int(obs_count.scalar() or 0)

    return {
        "verified_label": "KigaliRent Verified",
        "external_label": "External Market Observations",
        "external_disclaimer": (
            "Public listings observed on external sources; availability is not confirmed. "
            "A listing that disappears is marked not found — never assumed rented."
        ),
        "external_active_count": external_active_count,
        "price_range": {
            "verified": friendly_range_label(v),
            "external": friendly_range_label(o),
        },
        "by_bedroom": by_bedroom,
        "by_bedroom_external": by_bedroom_external,
        "by_neighborhood": by_neighborhood,
        "by_neighborhood_external": by_neighborhood_external,
        "trend": [
            {
                "period_end": r.period_end.isoformat(),
                "median_usd": r.median_usd,
                "sample_size": r.sample_size,
                "data_kind": r.data_kind,
            }
            for r in trend_rows
        ],
        "trend_external": trend_external,
        "observation_activity": activity,
        "has_trend_history": len(trend_rows) >= 2,
        "has_external_trend_history": len(trend_external) >= 2,
        "last_updated": (v.period_end.isoformat() if v else (o.period_end.isoformat() if o else None)),
    }


def textual_summary(snap: MarketStatSnapshot | None, label: str) -> str:
    if not snap or not snap.sample_size:
        return f"Not enough data yet to summarize asking rents for {label}."
    if snap.data_kind == "verified_kigali_rent":
        kind = "KigaliRent verified listings"
        caveat = ""
    else:
        kind = "external market observations"
        caveat = (
            " Public listings observed on external sources; availability is not confirmed."
        )
    typical = (
        f"Typical asking rent: ${snap.median_usd:,.0f}/month."
        if snap.median_usd is not None
        else "Typical asking rent is not available for this sample."
    )
    band = ""
    if snap.p25_usd is not None and snap.p75_usd is not None:
        band = (
            f" Most properties in this sample fall between "
            f"${snap.p25_usd:,.0f} and ${snap.p75_usd:,.0f}/month."
        )
    return (
        f"{typical}{band} "
        f"Based on {snap.sample_size} {kind} "
        f"(period ending {snap.period_end}).{caveat}"
    )


def friendly_range_label(snap: MarketStatSnapshot | None) -> dict:
    if not snap or not snap.sample_size:
        return {
            "typical": None,
            "range_text": "Not enough historical data yet.",
            "sample_size": 0,
            "data_kind": None,
        }
    return {
        "typical": snap.median_usd,
        "typical_text": f"Typical asking rent: ${snap.median_usd:,.0f}/month"
        if snap.median_usd is not None
        else None,
        "range_text": (
            f"Most properties in this sample fall between ${snap.p25_usd:,.0f} and ${snap.p75_usd:,.0f}/month."
            if snap.p25_usd is not None and snap.p75_usd is not None
            else "Not enough historical data yet."
        ),
        "sample_size": snap.sample_size,
        "data_kind": snap.data_kind,
        "period_end": snap.period_end.isoformat() if snap.period_end else None,
        "label": "KigaliRent Verified" if snap.data_kind == "verified_kigali_rent" else "External Market Observations",
    }
