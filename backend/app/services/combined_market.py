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
MIN_SAMPLE_VERIFIED_NEIGHBORHOOD = 3
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
            "middle_50_label": "Middle 50% of observed asking rents",
            "sample_size": 0,
            "plain_english": None,
            "summary": (
                "Not enough data to provide a reliable estimate yet. "
                "More eligible rental observations are needed before a defensible market figure can be shown."
            ),
        }
    typical = stats["median_usd"]
    range_text = (
        f"Middle 50% of observed asking rents: ${stats['p25_usd']:,.0f}–${stats['p75_usd']:,.0f}/month."
    )
    plain = (
        f"The typical (median) asking rent is ${typical:,.0f}/month. "
        f"Half of observed listings ask between ${stats['p25_usd']:,.0f} and ${stats['p75_usd']:,.0f}/month. "
        "These are asking rents, not confirmed lease transaction prices."
    )
    return {
        "has_enough_data": True,
        "question": subject,
        "headline": f"Typical asking rent: ${typical:,.0f}/month",
        "typical_usd": typical,
        "range_text": range_text,
        "middle_50_label": "Middle 50% of observed asking rents",
        "p25_usd": stats["p25_usd"],
        "p75_usd": stats["p75_usd"],
        "sample_size": stats["sample_size"],
        "plain_english": plain,
        "summary": (
            f"Based on {stats['sample_size']} eligible rental observations. "
            "Figures reflect asking rents, not confirmed lease transactions."
        ),
    }


def _period_from_rows(rows: list[dict[str, Any]]) -> tuple[date | None, date | None]:
    dates = [r["observed_at"] for r in rows if r.get("observed_at")]
    if not dates:
        return None, None
    start = min(dates)
    end = max(dates)
    start_d = start.date() if isinstance(start, datetime) else start
    end_d = end.date() if isinstance(end, datetime) else end
    return start_d, end_d


def _group_stats(
    rows: list[dict[str, Any]],
    *,
    key_fn,
    label_fn,
    min_sample: int = MIN_SAMPLE_PUBLIC,
) -> list[dict[str, Any]]:
    groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        k = key_fn(r)
        if k is None:
            continue
        groups[k].append(r)
    out: list[dict[str, Any]] = []
    for key, group in groups.items():
        st = compute_stats([g["usd"] for g in group], min_sample=min_sample)
        if not st:
            continue
        period_start, period_end = _period_from_rows(group)
        out.append(
            {
                "key": key,
                "label": label_fn(key, group),
                "median_usd": st["median_usd"],
                "p25_usd": st["p25_usd"],
                "p75_usd": st["p75_usd"],
                "sample_size": st["sample_size"],
                "period_start": period_start.isoformat() if period_start else None,
                "period_end": period_end.isoformat() if period_end else None,
            }
        )
    return out


def _group_neighborhood_stats(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Neighborhood medians — prefer KigaliRent Verified inventory when sample is strong enough."""
    hood_rows = [r for r in rows if (r.get("location_slug") or "") not in {"kigali", "", None}]
    groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for row in hood_rows:
        groups[row.get("location_slug")].append(row)

    out: list[dict[str, Any]] = []
    for key, group in groups.items():
        verified = [g for g in group if g.get("origin") == "verified"]
        prices = [g["usd"] for g in group]
        sample_min = MIN_SAMPLE_PUBLIC
        if len(verified) >= MIN_SAMPLE_VERIFIED_NEIGHBORHOOD:
            prices = [g["usd"] for g in verified]
            sample_min = MIN_SAMPLE_VERIFIED_NEIGHBORHOOD

        st = compute_stats(prices, min_sample=sample_min)
        if not st:
            continue
        period_start, period_end = _period_from_rows(group)
        out.append(
            {
                "key": key,
                "label": group[0].get("location_name") or str(key).replace("-", " ").title(),
                "median_usd": st["median_usd"],
                "p25_usd": st["p25_usd"],
                "p75_usd": st["p75_usd"],
                "sample_size": st["sample_size"],
                "verified_count": len(verified),
                "period_start": period_start.isoformat() if period_start else None,
                "period_end": period_end.isoformat() if period_end else None,
            }
        )
    return out


def _budget_bands(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Share of observations by asking-rent budget band (when enough data)."""
    prices = remove_outliers([r["usd"] for r in rows])
    if len(prices) < MIN_SAMPLE_PUBLIC:
        return []
    bands = [
        (0, 500, "Under $500"),
        (500, 800, "$500–$800"),
        (800, 1200, "$800–$1,200"),
        (1200, 2000, "$1,200–$2,000"),
        (2000, 10_000_000, "$2,000+"),
    ]
    total = len(prices)
    out = []
    for lo, hi, label in bands:
        n = sum(1 for p in prices if lo <= p < hi)
        if n < 1:
            continue
        out.append(
            {
                "label": label,
                "count": n,
                "share_pct": round(100.0 * n / total, 1),
                "sample_size": total,
            }
        )
    return out


def _trend_with_change(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
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
                "pct_change": None,
            }
        )
    for i in range(1, len(trend)):
        prev = trend[i - 1]["median_usd"]
        cur = trend[i]["median_usd"]
        if prev and prev > 0:
            trend[i]["pct_change"] = round(100.0 * (cur - prev) / prev, 1)
    return trend


def build_narrative_sections(
    *,
    answer: dict[str, Any],
    insights: list[str],
    observation_count: int,
    period_start: str | None,
    period_end: str | None,
) -> dict[str, Any]:
    how_to = [
        "Typical asking rent means the median — half of observed listings ask less, half ask more.",
        "Middle 50% (P25–P75) is the range where the central half of observed asking rents fall.",
        "These figures are asking rents from eligible observations, not confirmed lease transactions.",
        "A listing that disappears from an external source is never assumed to have been rented.",
    ]
    methodology = [
        "Eligible observations include KigaliRent Verified listings and approved external market observations.",
        "Prices are normalized to USD, deduplicated, quality-checked, and screened for unreliable outliers.",
        "Statistics are published only when the sample size meets the minimum threshold.",
        "Source streams remain separate internally for provenance and auditing; public figures use the combined eligible set.",
    ]
    limitations = [
        "Asking rents are not confirmed transaction prices.",
        "Coverage varies by neighborhood, property type, and time period.",
        "Outlier screening removes extreme prices so a single listing cannot dominate results.",
        "Insufficient samples are shown as “not enough data” rather than invented estimates.",
    ]
    period_label = None
    if period_start and period_end:
        period_label = f"{period_start} to {period_end}"
    elif period_end:
        period_label = f"Through {period_end}"

    return {
        "what_the_data_shows": insights,
        "how_to_interpret": how_to,
        "methodology": methodology,
        "limitations": limitations,
        "last_updated": answer.get("last_updated") or period_end,
        "last_updated_display": answer.get("last_updated_display"),
        "observation_period": period_label,
        "observation_period_start": period_start,
        "observation_period_end": period_end,
        "number_of_observations": observation_count,
        "sources_url": "/research/kigali-rental-market/methodology",
        "methodology_url": "/research/kigali-rental-market/methodology",
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
    rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    all_rows = rows if rows is not None else await load_combined_rows(db)
    filtered = _filter_rows(
        all_rows,
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
        subject = f"What is the typical rent for {property_type.replace('-', ' ')}s in {loc_label}?"
    else:
        subject = f"How much does renting in {loc_label} typically cost?"

    answer = format_answer(stats, subject=subject)
    verified_n = sum(1 for r in filtered if r["origin"] == "verified")
    external_n = sum(1 for r in filtered if r["origin"] == "external")
    period_start, period_end = _period_from_rows(filtered)
    if answer.get("has_enough_data") and stats:
        answer["summary"] = (
            f"Based on {stats['sample_size']} eligible rental observations"
            + (f" from {period_start.isoformat()} to {period_end.isoformat()}" if period_start and period_end else "")
            + ". Figures reflect asking rents, not confirmed lease transactions."
        )

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


def _build_slice_comparisons(filtered: list[dict[str, Any]], *, location_slug: str) -> dict[str, Any]:
    by_bedroom = _group_stats(
        filtered,
        key_fn=lambda r: min(int(r["bedrooms"]), 4) if r.get("bedrooms") is not None else None,
        label_fn=lambda k, _g: "4+" if k >= 4 else str(k),
    )
    by_bedroom.sort(key=lambda x: int(x["key"]) if isinstance(x["key"], int) else 99)
    for row in by_bedroom:
        row["bedrooms"] = row["key"]

    by_property_type = _group_stats(
        filtered,
        key_fn=lambda r: (r.get("property_type") or "").lower() or None,
        label_fn=lambda k, _g: str(k).replace("-", " ").title(),
    )
    by_property_type.sort(key=lambda x: -(x["median_usd"] or 0))

    hood_rows = filtered
    if location_slug in {"kigali", "all", None}:
        hood_rows = [r for r in filtered if (r.get("location_slug") or "") not in {"kigali", "", None}]
    by_neighborhood = _group_neighborhood_stats(hood_rows)
    by_neighborhood.sort(key=lambda x: -(x["median_usd"] or 0))
    for row in by_neighborhood:
        row["location_slug"] = row["key"]

    furnished_prices = [r["usd"] for r in filtered if r.get("is_furnished") is True]
    unfurnished_prices = [r["usd"] for r in filtered if r.get("is_furnished") is False]
    furnished_stats = compute_stats(furnished_prices, min_sample=MIN_SAMPLE_PUBLIC)
    unfurnished_stats = compute_stats(unfurnished_prices, min_sample=MIN_SAMPLE_PUBLIC)
    furnished_breakdown = {
        "furnished": {
            "count": len(furnished_prices),
            "median_usd": furnished_stats["median_usd"] if furnished_stats else None,
            "p25_usd": furnished_stats["p25_usd"] if furnished_stats else None,
            "p75_usd": furnished_stats["p75_usd"] if furnished_stats else None,
            "sample_size": furnished_stats["sample_size"] if furnished_stats else 0,
        },
        "unfurnished": {
            "count": len(unfurnished_prices),
            "median_usd": unfurnished_stats["median_usd"] if unfurnished_stats else None,
            "p25_usd": unfurnished_stats["p25_usd"] if unfurnished_stats else None,
            "p75_usd": unfurnished_stats["p75_usd"] if unfurnished_stats else None,
            "sample_size": unfurnished_stats["sample_size"] if unfurnished_stats else 0,
        },
    }

    trend = _trend_with_change(filtered)
    budget = _budget_bands(filtered)

    insights: list[str] = []
    overall_stats = compute_stats([r["usd"] for r in filtered])
    if overall_stats:
        insights.append(
            f"Typical asking rent is ${overall_stats['median_usd']:,.0f}/month "
            f"based on {overall_stats['sample_size']} eligible observations."
        )
        insights.append(
            f"Middle 50% of observed asking rents: "
            f"${overall_stats['p25_usd']:,.0f}–${overall_stats['p75_usd']:,.0f}/month."
        )
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
            f"versus ${unfurnished_stats['median_usd']:,.0f}/month for unfurnished."
        )
    if len(by_neighborhood) >= 2:
        top = by_neighborhood[0]
        low = by_neighborhood[-1]
        insights.append(
            f"Among neighbourhoods with enough data, typical asking rents range from "
            f"${low['median_usd']:,.0f}/month in {low['label']} to ${top['median_usd']:,.0f}/month in {top['label']}."
        )
    if len(trend) >= 2 and trend[-1].get("pct_change") is not None:
        ch = trend[-1]["pct_change"]
        direction = "up" if ch > 0 else "down" if ch < 0 else "unchanged"
        insights.append(
            f"Latest month-over-month typical asking rent is {direction} "
            f"{abs(ch):.1f}% (based on {trend[-1]['sample_size']} observations in {trend[-1]['label']})."
        )
    if budget:
        top_band = max(budget, key=lambda b: b["share_pct"])
        insights.append(
            f"The largest budget share is {top_band['label']} "
            f"({top_band['share_pct']}% of {top_band['sample_size']} screened observations)."
        )

    return {
        "by_bedroom": by_bedroom,
        "by_neighborhood": by_neighborhood[:15],
        "by_property_type": by_property_type,
        "furnished_breakdown": furnished_breakdown,
        "trend": trend,
        "has_trend_history": len(trend) >= 2,
        "budget_bands": budget,
        "insights": [i for i in insights if i][:8],
    }


async def combined_slice_context(
    db: AsyncSession,
    *,
    location_slug: str = "kigali",
    bedrooms: int | None = None,
    property_type: str | None = None,
    furnished: bool | None = None,
) -> dict[str, Any]:
    """Market context for a rental landing filter — combined observations only."""
    rows = await load_combined_rows(db)
    answer = await combined_market_answer(
        db,
        location_slug=location_slug,
        bedrooms=bedrooms,
        property_type=property_type,
        furnished=furnished,
        rows=rows,
    )
    # Comparisons use the same geographic scope, but relax type/beds so users still see useful context
    geo_rows = _filter_rows(rows, location_slug=location_slug)
    # If the page is already bedroom/type specific, keep comparisons within that filter when enough data
    scoped = _filter_rows(
        rows,
        location_slug=location_slug,
        bedrooms=bedrooms,
        property_type=property_type,
        furnished=furnished,
    )
    comparison_rows = scoped if len(scoped) >= MIN_SAMPLE_PUBLIC * 2 else geo_rows
    comps = _build_slice_comparisons(comparison_rows, location_slug=location_slug)
    sections = build_narrative_sections(
        answer=answer,
        insights=comps["insights"],
        observation_count=answer.get("sample_size") or 0,
        period_start=answer.get("period_start"),
        period_end=answer.get("period_end"),
    )
    return {
        "market_answer": answer,
        **comps,
        "sections": sections,
        "data_insights": comps["insights"],
    }


async def combined_research_payload(db: AsyncSession) -> dict[str, Any]:
    """Public research hub payload — one combined market picture."""
    rows = await load_combined_rows(db)
    overall = await combined_market_answer(db, location_slug="kigali", rows=rows)
    comps = _build_slice_comparisons(rows, location_slug="kigali")

    bedroom_answers = []
    for bed in (1, 2, 3, 4):
        ans = await combined_market_answer(db, location_slug="kigali", bedrooms=bed, rows=rows)
        if ans.get("has_enough_data"):
            bedroom_answers.append(ans)

    type_answers = []
    for pt in ("apartment", "house", "villa"):
        ans = await combined_market_answer(db, location_slug="kigali", property_type=pt, rows=rows)
        if ans.get("has_enough_data"):
            type_answers.append(ans)

    sections = build_narrative_sections(
        answer=overall,
        insights=comps["insights"],
        observation_count=overall.get("sample_size") or len(rows),
        period_start=overall.get("period_start"),
        period_end=overall.get("period_end"),
    )

    from app.services.research_meta import research_transparency

    transparency = await research_transparency(db)
    about = {
        "observation_count": overall.get("sample_size") or len(rows),
        "period_start": overall.get("period_start"),
        "period_end": overall.get("period_end"),
        "last_updated": overall.get("last_updated"),
        "last_updated_display": overall.get("last_updated_display"),
        "methodology_summary": (
            "Eligible asking rents from verified listings and approved external market observations "
            "are normalized to USD, deduplicated, screened for outliers, and combined into a single "
            "market estimate when sample size is sufficient."
        ),
        "limitations": sections["limitations"],
        "how_to_interpret": sections["how_to_interpret"],
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
        "property_type_answers": type_answers,
        "insights": comps["insights"],
        "by_bedroom": comps["by_bedroom"],
        "by_neighborhood": comps["by_neighborhood"],
        "by_property_type": comps["by_property_type"],
        "furnished_breakdown": comps["furnished_breakdown"],
        "budget_bands": comps["budget_bands"],
        "trend": comps["trend"],
        "has_trend_history": comps["has_trend_history"],
        "sections": sections,
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
                f'Based on {overall.get("sample_size") or 0} eligible rental observations (asking rents).'
            ),
        },
        "last_updated": overall.get("last_updated"),
    }
