"""Market research aggregates from verified inventory and observations."""

from __future__ import annotations

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
    period_end = period_end or date.today()
    period_start = period_end.replace(day=1)
    start_dt = datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(period_end, datetime.max.time(), tzinfo=timezone.utc)

    result = await db.execute(
        select(RentalObservation).where(
            RentalObservation.observed_at >= start_dt,
            RentalObservation.observed_at <= end_dt,
            RentalObservation.observation_status.in_(["active_observed", "price_changed"]),
            RentalObservation.usd_price.is_not(None),
        )
    )
    rows = list(result.scalars().all())
    buckets: dict[tuple, list[float]] = defaultdict(list)
    for o in rows:
        loc = o.neighborhood_slug or "kigali"
        buckets[(loc, o.neighborhood, o.property_type, o.bedrooms, o.is_furnished)].append(float(o.usd_price))
        buckets[("kigali", "Kigali", o.property_type, o.bedrooms, None)].append(float(o.usd_price))

    existing = await db.execute(
        select(MarketStatSnapshot).where(
            MarketStatSnapshot.period_end == period_end,
            MarketStatSnapshot.data_kind == MarketDataKind.MARKET_OBSERVATION.value,
        )
    )
    for row in existing.scalars().all():
        await db.delete(row)
    await db.flush()

    created = 0
    for (loc, loc_name, ptype, beds, furnished), prices in buckets.items():
        if len(prices) < MIN_SAMPLE:
            continue
        st = _stats(prices)
        db.add(
            MarketStatSnapshot(
                period_start=period_start,
                period_end=period_end,
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
    result = await db.execute(select(RentalObservation.observed_at, RentalObservation.id))
    counts: Counter[str] = Counter()
    for observed_at, _ in result.all():
        if not observed_at:
            continue
        key = observed_at.strftime("%Y-%m")
        counts[key] += 1
    keys = sorted(counts.keys())[-months:]
    return [{"month": k, "observations": counts[k]} for k in keys]


def textual_summary(snap: MarketStatSnapshot | None, label: str) -> str:
    if not snap or not snap.sample_size:
        return f"Insufficient sample size to publish statistics for {label}."
    kind = "verified KigaliRent listings" if snap.data_kind == "verified_kigali_rent" else "external market observations"
    return (
        f"Based on {snap.sample_size} {kind} "
        f"(period ending {snap.period_end}), median asking rent is "
        f"${snap.median_usd:,.0f}/month "
        f"(P25 ${snap.p25_usd:,.0f} – P75 ${snap.p75_usd:,.0f})."
    )
