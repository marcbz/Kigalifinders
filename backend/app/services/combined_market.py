"""Combined Kigali rental market statistics for public research.

Internally keeps verified listings and external observations separate for provenance.
Public answers use ONE combined, quality-filtered dataset — never competing rates.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    ListingType,
    Property,
    PropertyStatusEnum,
    RentalObservation,
)
from app.services.fx import effective_usd_price

MIN_SAMPLE_PUBLIC = 5
MIN_SAMPLE_TREND = 3
OUTLIER_IQR_FACTOR = 1.5


def _now() -> datetime:
    return datetime.now(timezone.utc)


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


def remove_outliers(prices: list[float], *, factor: float = OUTLIER_IQR_FACTOR) -> list[float]:
    """Drop extreme asking rents via IQR fence. Keeps all values when n is small."""
    vals = sorted(v for v in prices if v is not None and v > 0)
    if len(vals) < 8:
        return vals
    q1 = _percentile(vals, 0.25)
    q3 = _percentile(vals, 0.75)
    if q1 is None or q3 is None:
        return vals
    iqr = q3 - q1
    if iqr <= 0:
        return vals
    lo = q1 - factor * iqr
    hi = q3 + factor * iqr
    filtered = [v for v in vals if lo <= v <= hi]
    return filtered if len(filtered) >= MIN_SAMPLE_TREND else vals


def compute_stats(prices: list[float], *, min_sample: int = MIN_SAMPLE_PUBLIC) -> dict[str, Any] | None:
    cleaned = remove_outliers(prices)
    if len(cleaned) < min_sample:
        return None
    return {
        "sample_size": len(cleaned),
        "raw_count": len(prices),
        "outliers_removed": max(0, len(prices) - len(cleaned)),
        "median_usd": round(statistics.median(cleaned), 2),
        "p25_usd": round(_percentile(cleaned, 0.25) or 0, 2),
        "p75_usd": round(_percentile(cleaned, 0.75) or 0, 2),
        "min_usd": round(min(cleaned), 2),
        "max_usd": round(max(cleaned), 2),
    }


def format_answer(stats: dict[str, Any] | None, *, subject: str) -> dict[str, Any]:
    if not stats:
        return {
            "has_enough_data": False,
            "question": subject,
            "headline": None,
            "typical_usd": None,
            "range_text": None,
            "sample_size": 0,
            "summary": (
                f"Not enough eligible observations yet to estimate {subject.lower()}. "
                "More rental listings are needed before a defensible market figure can be shown."
            ),
        }
    typical = stats["median_usd"]
    range_text = (
        f"Most observed asking rents fall between ${stats['p25_usd']:,.0f} and ${stats['p75_usd']:,.0f}/month."
    )
    return {
        "has_enough_data": True,
        "question": subject,
        "headline": f"Typical asking rent: ${typical:,.0f}/month",
        "typical_usd": typical,
        "range_text": range_text,
        "sample_size": stats["sample_size"],
        "summary": (
            f"Based on {stats['sample_size']} observed rental listings. "
            "Figures reflect asking rents, not confirmed lease transactions."
        ),
    }


async def _eligible_verified_rows(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.neighborhood), selectinload(Property.property_type))
        .where(
            Property.status == PropertyStatusEnum.PUBLISHED,
            Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]),
        )
    )
    out: list[dict[str, Any]] = []
    for p in result.scalars().all():
        usd = effective_usd_price(p)
        if usd is None or usd <= 0:
            continue
        out.append(
            {
                "usd": float(usd),
                "bedrooms": p.bedrooms,
                "is_furnished": bool(p.is_furnished or p.listing_type == ListingType.FURNISHED),
                "property_type": (p.property_type.slug if p.property_type else None),
                "location_slug": p.neighborhood.slug if p.neighborhood else "kigali",
                "location_name": p.neighborhood.name if p.neighborhood else "Kigali",
                "observed_at": p.last_verified_at or p.updated_at or p.created_at,
                "origin": "verified",
                "dedupe": f"verified:{p.id}",
            }
        )
    return out


async def _eligible_observation_rows(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(RentalObservation).where(
            RentalObservation.observation_status.in_(["active_observed", "price_changed"]),
            RentalObservation.usd_price.is_not(None),
        )
    )
    out: list[dict[str, Any]] = []
    for o in result.scalars().all():
        usd = float(o.usd_price or 0)
        if usd <= 0:
            continue
        out.append(
            {
                "usd": usd,
                "bedrooms": o.bedrooms,
                "is_furnished": o.is_furnished,
                "property_type": (o.property_type or "").lower() or None,
                "location_slug": o.neighborhood_slug or "kigali",
                "location_name": o.neighborhood or (o.neighborhood_slug or "kigali").replace("-", " ").title(),
                "observed_at": o.observed_at,
                "origin": "external",
                "dedupe": o.dedupe_key or f"obs:{o.id}",
            }
        )
    return out


def _dedupe_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep the most recent row per dedupe key (verified and external stay on separate keys)."""
    best: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = row["dedupe"]
        prev = best.get(key)
        if not prev:
            best[key] = row
            continue
        a = prev.get("observed_at") or datetime.min.replace(tzinfo=timezone.utc)
        b = row.get("observed_at") or datetime.min.replace(tzinfo=timezone.utc)
        if getattr(a, "tzinfo", None) is None:
            a = a.replace(tzinfo=timezone.utc) if isinstance(a, datetime) else a
        if getattr(b, "tzinfo", None) is None:
            b = b.replace(tzinfo=timezone.utc) if isinstance(b, datetime) else b
        if b >= a:
            best[key] = row
    return list(best.values())


async def load_combined_rows(db: AsyncSession) -> list[dict[str, Any]]:
    verified = await _eligible_verified_rows(db)
    external = await _eligible_observation_rows(db)
    return _dedupe_rows(verified + external)


def _filter_rows(
    rows: list[dict[str, Any]],
    *,
    location_slug: str | None = None,
    bedrooms: int | None = None,
    property_type: str | None = None,
    furnished: bool | None = None,
) -> list[dict[str, Any]]:
    out = rows
    if location_slug and location_slug.lower() not in {"kigali", "all"}:
        out = [r for r in out if (r.get("location_slug") or "").lower() == location_slug.lower()]
    if bedrooms is not None:
        out = [r for r in out if r.get("bedrooms") is not None and int(r["bedrooms"]) == int(bedrooms)]
    if property_type:
        pt = property_type.lower()
        out = [r for r in out if (r.get("property_type") or "").lower() == pt]
    if furnished is not None:
        out = [r for r in out if r.get("is_furnished") is furnished]
    return out


def _month_key(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%Y-%m")


async def combined_market_answer(
    db: AsyncSession,
    *,
    location_slug: str = "kigali",
    bedrooms: int | None = None,
    property_type: str | None = None,
    furnished: bool | None = None,
) -> dict[str, Any]:
    rows = await load_combined_rows(db)
    filtered = _filter_rows(
        rows,
        location_slug=location_slug,
        bedrooms=bedrooms,
        property_type=property_type,
        furnished=furnished,
    )
    prices = [r["usd"] for r in filtered]
    stats = compute_stats(prices)

    loc_label = "Kigali" if location_slug in {"kigali", "all", None} else location_slug.replace("-", " ").title()
    if bedrooms is not None and property_type:
        subject = f"How much does a {bedrooms}-bedroom {property_type.replace('-', ' ')} cost in {loc_label}?"
    elif bedrooms is not None:
        subject = f"How much does a {bedrooms}-bedroom rental cost in {loc_label}?"
    elif property_type:
        subject = f"How much does a {property_type.replace('-', ' ')} cost in {loc_label}?"
    else:
        subject = f"How much does renting in {loc_label} typically cost?"

    answer = format_answer(stats, subject=subject)
    verified_n = sum(1 for r in filtered if r["origin"] == "verified")
    external_n = sum(1 for r in filtered if r["origin"] == "external")
    dates = [r["observed_at"] for r in filtered if r.get("observed_at")]
    period_start = min(dates).date() if dates else None
    period_end = max(dates).date() if dates else date.today()

    return {
        **answer,
        "location_slug": location_slug,
        "bedrooms": bedrooms,
        "property_type": property_type,
        "stats": stats,
        "provenance": {
            "verified_count": verified_n,
            "external_count": external_n,
            "eligible_before_outlier_filter": len(prices),
            "outliers_removed": (stats or {}).get("outliers_removed", 0),
        },
        "period_start": period_start.isoformat() if period_start else None,
        "period_end": period_end.isoformat() if period_end else None,
        "last_updated": period_end.isoformat() if period_end else date.today().isoformat(),
        "last_updated_display": period_end.strftime("%B %Y") if period_end else None,
        "asking_rent_note": "These figures are based on asking rents, not confirmed lease transactions.",
    }


async def combined_research_payload(db: AsyncSession) -> dict[str, Any]:
    """Public research hub payload — one combined market picture."""
    rows = await load_combined_rows(db)
    overall = await combined_market_answer(db, location_slug="kigali")

    # By bedroom
    by_bedroom: list[dict[str, Any]] = []
    bed_groups: dict[int, list[float]] = defaultdict(list)
    for r in rows:
        if r.get("bedrooms") is None:
            continue
        bed = min(int(r["bedrooms"]), 4)
        bed_groups[bed].append(r["usd"])
    for bed in sorted(bed_groups.keys()):
        st = compute_stats(bed_groups[bed], min_sample=MIN_SAMPLE_PUBLIC)
        if not st:
            continue
        by_bedroom.append(
            {
                "bedrooms": bed,
                "label": "4+" if bed >= 4 else str(bed),
                "median_usd": st["median_usd"],
                "p25_usd": st["p25_usd"],
                "p75_usd": st["p75_usd"],
                "sample_size": st["sample_size"],
            }
        )

    # By neighborhood
    by_neighborhood: list[dict[str, Any]] = []
    hood_groups: dict[str, list[tuple[float, str]]] = defaultdict(list)
    for r in rows:
        slug = r.get("location_slug") or "kigali"
        if slug == "kigali":
            continue
        hood_groups[slug].append((r["usd"], r.get("location_name") or slug.title()))
    for slug, pairs in hood_groups.items():
        st = compute_stats([p[0] for p in pairs], min_sample=MIN_SAMPLE_PUBLIC)
        if not st:
            continue
        by_neighborhood.append(
            {
                "location_slug": slug,
                "label": pairs[0][1],
                "median_usd": st["median_usd"],
                "p25_usd": st["p25_usd"],
                "p75_usd": st["p75_usd"],
                "sample_size": st["sample_size"],
            }
        )
    by_neighborhood.sort(key=lambda x: -(x["median_usd"] or 0))

    # Furnished vs unfurnished
    furnished_prices = [r["usd"] for r in rows if r.get("is_furnished") is True]
    unfurnished_prices = [r["usd"] for r in rows if r.get("is_furnished") is False]
    furnished_stats = compute_stats(furnished_prices, min_sample=MIN_SAMPLE_PUBLIC)
    unfurnished_stats = compute_stats(unfurnished_prices, min_sample=MIN_SAMPLE_PUBLIC)
    furnished_breakdown = {
        "furnished": {
            "count": len(furnished_prices),
            "median_usd": furnished_stats["median_usd"] if furnished_stats else None,
            "sample_size": furnished_stats["sample_size"] if furnished_stats else 0,
        },
        "unfurnished": {
            "count": len(unfurnished_prices),
            "median_usd": unfurnished_stats["median_usd"] if unfurnished_stats else None,
            "sample_size": unfurnished_stats["sample_size"] if unfurnished_stats else 0,
        },
    }

    # Property types
    type_groups: dict[str, list[float]] = defaultdict(list)
    for r in rows:
        pt = r.get("property_type")
        if not pt:
            continue
        type_groups[pt].append(r["usd"])
    by_property_type: list[dict[str, Any]] = []
    for pt, prices in sorted(type_groups.items(), key=lambda x: -len(x[1])):
        st = compute_stats(prices, min_sample=MIN_SAMPLE_PUBLIC)
        if not st:
            continue
        by_property_type.append(
            {
                "property_type": pt,
                "label": pt.replace("-", " ").title(),
                "median_usd": st["median_usd"],
                "sample_size": st["sample_size"],
            }
        )

    # Trend by calendar month (combined)
    month_prices: dict[str, list[float]] = defaultdict(list)
    for r in rows:
        key = _month_key(r.get("observed_at"))
        if key:
            month_prices[key].append(r["usd"])
    trend: list[dict[str, Any]] = []
    for month in sorted(month_prices.keys())[-24:]:
        st = compute_stats(month_prices[month], min_sample=MIN_SAMPLE_TREND)
        if not st:
            continue
        trend.append(
            {
                "period_end": f"{month}-01",
                "label": month,
                "median_usd": st["median_usd"],
                "sample_size": st["sample_size"],
            }
        )

    # Bedroom answers for common queries
    bedroom_answers = []
    for bed in (1, 2, 3, 4):
        ans = await combined_market_answer(db, location_slug="kigali", bedrooms=bed)
        if ans.get("has_enough_data"):
            bedroom_answers.append(ans)

    insights: list[str] = []
    if overall.get("has_enough_data") and overall.get("stats"):
        insights.append(
            f"City-wide typical asking rent is ${overall['stats']['median_usd']:,.0f}/month "
            f"based on {overall['sample_size']} observed listings."
        )
        insights.append(overall["stats"] and overall.get("range_text") or "")
    if len(by_bedroom) >= 2:
        cheapest = min(by_bedroom, key=lambda x: x["median_usd"])
        priciest = max(by_bedroom, key=lambda x: x["median_usd"])
        insights.append(
            f"By bedrooms, typical asking rents range from ${cheapest['median_usd']:,.0f}/month "
            f"({cheapest['label']} bed) to ${priciest['median_usd']:,.0f}/month ({priciest['label']} bed)."
        )
    if furnished_stats and unfurnished_stats:
        insights.append(
            f"Furnished listings typically ask around ${furnished_stats['median_usd']:,.0f}/month "
            f"versus ${unfurnished_stats['median_usd']:,.0f}/month for unfurnished "
            f"(asking rents; samples of {furnished_stats['sample_size']} and {unfurnished_stats['sample_size']})."
        )
    if len(by_neighborhood) >= 2:
        top = by_neighborhood[0]
        low = by_neighborhood[-1]
        insights.append(
            f"Among neighborhoods with enough data, typical asking rents range from "
            f"${low['median_usd']:,.0f}/month in {low['label']} to ${top['median_usd']:,.0f}/month in {top['label']}."
        )
    insights = [i for i in insights if i][:6]

    from app.services.research_meta import research_transparency

    transparency = await research_transparency(db)
    # Public-facing about-this-data: emphasize combined observation count, soft-pedal source split
    about = {
        "observation_count": overall.get("sample_size") or len(rows),
        "period_start": overall.get("period_start"),
        "period_end": overall.get("period_end"),
        "last_updated": overall.get("last_updated"),
        "last_updated_display": overall.get("last_updated_display"),
        "methodology_summary": (
            "Eligible asking rents from verified KigaliRent listings and approved external market "
            "observations are normalized to USD, deduplicated, screened for outliers, and combined "
            "into a single market estimate when sample size is sufficient."
        ),
        "limitations": [
            "Figures reflect asking rents, not confirmed lease or sale prices.",
            "Listings that disappear from external sources are not assumed rented.",
            "Statistics are withheld when too few eligible observations exist.",
            "Unusual prices are excluded via outlier screening so one listing cannot dominate the result.",
        ],
        "provenance_note": (
            "Source streams remain separated internally for quality control and auditing; "
            "public research presents one combined market result."
        ),
        "sources_url": "/research/kigali-rental-market/methodology",
        "methodology_url": "/research/kigali-rental-market/methodology",
    }

    return {
        "title": "Kigali Rental Market Data & Research",
        "primary_answer": overall,
        "bedroom_answers": bedroom_answers,
        "insights": insights,
        "by_bedroom": by_bedroom,
        "by_neighborhood": by_neighborhood[:15],
        "by_property_type": by_property_type,
        "furnished_breakdown": furnished_breakdown,
        "trend": trend,
        "has_trend_history": len(trend) >= 2,
        "about": about,
        "transparency": transparency,
        "citation": {
            "title": "Kigali Rental Market Data & Research",
            "canonical_url": "https://kigalirent.com/research/kigali-rental-market",
            "last_updated": overall.get("last_updated_display"),
            "text": (
                f'KigaliRent Research. "Kigali Rental Market Data & Research." '
                f'{overall.get("last_updated_display") or "n.d."}. '
                f"https://kigalirent.com/research/kigali-rental-market. "
                f'Based on {overall.get("sample_size") or 0} observed rental listings (asking rents).'
            ),
        },
        "last_updated": overall.get("last_updated"),
    }
