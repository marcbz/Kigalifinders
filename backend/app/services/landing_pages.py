"""Shared content builders for public rental landing pages."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MarketDataKind, MarketStatSnapshot
from app.services.intent_copy import normalize_query
from app.services.search_intent import MIN_SAMPLE_FOR_STATS


def sitemap_destination(path: str) -> str:
    """Human-readable sitemap bucket for admin display."""
    path = (path or "").rstrip("/") or "/"
    if path == "/rentals":
        return "Rentals"
    parts = [p for p in path.split("/") if p]
    if len(parts) == 2 and parts[0] == "rentals":
        return "Rentals / Areas"
    if len(parts) >= 3 and parts[0] == "rentals":
        return "Rentals / Search"
    return "Rentals"


def key_attributes_from_query(query: dict[str, Any]) -> list[str]:
    q = normalize_query(query)
    attrs: list[str] = []
    loc = q.get("location", "kigali")
    if loc and loc != "kigali":
        attrs.append(loc.replace("-", " ").title())
    elif loc == "kigali":
        attrs.append("Kigali-wide")
    if q.get("bedrooms") is not None:
        attrs.append(f"{q['bedrooms']} bedroom")
    if q.get("bathrooms") is not None:
        baths = q["bathrooms"]
        label = str(int(baths)) if float(baths).is_integer() else str(baths)
        attrs.append(f"{label} bathroom")
    if q.get("furnished") is True:
        attrs.append("Furnished")
    elif q.get("furnished") is False:
        attrs.append("Unfurnished")
    ptype = q.get("property_type")
    if ptype:
        attrs.append(ptype.replace("-", " ").title())
    for a in q.get("amenities") or []:
        attrs.append(a.replace("_", " ").title())
    if q.get("max_price_usd") is not None:
        attrs.append(f"Under ${int(q['max_price_usd']):,}/month")
    if q.get("min_price_usd") is not None and q.get("max_price_usd") is None:
        attrs.append(f"From ${int(q['min_price_usd']):,}/month")
    return attrs


def generate_intro_text(
    query: dict[str, Any],
    *,
    match_count: int,
    observation_count: int,
    verified_snap: dict[str, Any] | None,
    observation_snap: dict[str, Any] | None,
    location_name: str | None = None,
) -> str:
    q = normalize_query(query)
    loc = location_name or (q["location"].replace("-", " ").title() if q["location"] != "kigali" else "Kigali")
    parts: list[str] = []

    if match_count:
        parts.append(
            f"KigaliRent currently lists {match_count} verified rental "
            f"{'property' if match_count == 1 else 'properties'} matching this search in {loc}."
        )
    elif observation_count:
        parts.append(
            f"We do not have verified KigaliRent listings for this exact search in {loc} right now, "
            f"but we track {observation_count} external market observation{'s' if observation_count != 1 else ''} "
            "that may help with price context."
        )
    else:
        parts.append(
            f"This page tracks rentals in {loc} matching your filters. "
            "We add verified listings and external observations as they become available."
        )

    if verified_snap and verified_snap.get("median_usd"):
        parts.append(
            f"Verified listings in our sample typically ask around ${verified_snap['median_usd']:,.0f}/month "
            f"(n={verified_snap.get('sample_size', 0)})."
        )
    elif observation_snap and observation_snap.get("median_usd"):
        parts.append(
            f"External market observations in this area suggest typical asking rents around "
            f"${observation_snap['median_usd']:,.0f}/month (n={observation_snap.get('sample_size', 0)}). "
            "These are not confirmed vacancies."
        )

    return " ".join(parts)


def build_data_insights(
    *,
    match_count: int,
    observation_count: int,
    verified_snap: dict[str, Any] | None,
    observation_snap: dict[str, Any] | None,
    furnished: dict[str, int] | None,
    by_bedroom_verified: list[dict[str, Any]],
    by_bedroom_external: list[dict[str, Any]],
) -> list[str]:
    insights: list[str] = []
    if match_count:
        insights.append(f"{match_count} KigaliRent Verified {'listing matches' if match_count != 1 else 'listing matches'} this search today.")
    if observation_count:
        insights.append(
            f"{observation_count} external market observation{'s' if observation_count != 1 else ''} "
            "inform price context — not verified availability."
        )
    if verified_snap and verified_snap.get("p25_usd") and verified_snap.get("p75_usd"):
        insights.append(
            f"Verified asking rents in this sample usually fall between "
            f"${verified_snap['p25_usd']:,.0f} and ${verified_snap['p75_usd']:,.0f}/month."
        )
    if observation_snap and observation_snap.get("p25_usd") and observation_snap.get("p75_usd"):
        insights.append(
            f"External observations suggest a wider market range of "
            f"${observation_snap['p25_usd']:,.0f}–${observation_snap['p75_usd']:,.0f}/month."
        )
    if furnished and furnished.get("total", 0) >= 3:
        insights.append(
            f"Among verified matches: {furnished['furnished']} furnished, {furnished['unfurnished']} unfurnished."
        )
    if len(by_bedroom_verified) >= 2:
        cheapest = min(by_bedroom_verified, key=lambda r: r.get("median_usd") or 999999)
        priciest = max(by_bedroom_verified, key=lambda r: r.get("median_usd") or 0)
        if cheapest.get("median_usd") and priciest.get("median_usd"):
            insights.append(
                f"Verified medians range from ${cheapest['median_usd']:,.0f}/month "
                f"({cheapest['bedrooms']} bed) to ${priciest['median_usd']:,.0f}/month ({priciest['bedrooms']} bed)."
            )
    if len(by_bedroom_external) >= 2 and not by_bedroom_verified:
        cheapest = min(by_bedroom_external, key=lambda r: r.get("median_usd") or 999999)
        priciest = max(by_bedroom_external, key=lambda r: r.get("median_usd") or 0)
        if cheapest.get("median_usd") and priciest.get("median_usd"):
            insights.append(
                f"External observations by bedroom span ${cheapest['median_usd']:,.0f}–${priciest['median_usd']:,.0f}/month."
            )
    return insights[:6]


async def trend_series_for_location(
    db: AsyncSession,
    *,
    location_slug: str,
    data_kind: str,
    bedrooms: int | None = None,
    property_type: str | None = None,
    min_points: int = 2,
    limit: int = 24,
) -> list[dict[str, Any]]:
    q = (
        select(MarketStatSnapshot)
        .where(
            MarketStatSnapshot.location_slug == location_slug,
            MarketStatSnapshot.data_kind == data_kind,
            MarketStatSnapshot.sample_size >= MIN_SAMPLE_FOR_STATS,
        )
        .order_by(MarketStatSnapshot.period_end.asc())
        .limit(limit)
    )
    if bedrooms is None:
        q = q.where(MarketStatSnapshot.bedrooms.is_(None))
    else:
        q = q.where(MarketStatSnapshot.bedrooms == bedrooms)
    if property_type is None:
        q = q.where(MarketStatSnapshot.property_type.is_(None))
    else:
        q = q.where(MarketStatSnapshot.property_type == property_type)

    rows = list((await db.execute(q)).scalars().all())
    if len(rows) < min_points:
        return []

    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        if not row.median_usd:
            continue
        key = row.period_end.strftime("%Y-%m") if row.period_end else str(row.id)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "label": row.period_end.strftime("%b %Y") if row.period_end else key,
                "median_usd": row.median_usd,
                "sample_size": row.sample_size,
                "period_end": row.period_end.isoformat() if row.period_end else None,
            }
        )
    return out if len(out) >= min_points else []


def publishing_rule_counts(intents: list[Any]) -> dict[str, int]:
    """Plain counts for admin publishing rules results."""
    from app.models import AutomaticEligibility, SearchIndexStatus

    terminal = {
        SearchIndexStatus.INDEXABLE.value,
        SearchIndexStatus.NOINDEX.value,
        SearchIndexStatus.DISABLED.value,
    }
    ready = 0
    not_ready = 0
    for intent in intents:
        if intent.index_status in terminal:
            continue
        if intent.automatic_eligibility == AutomaticEligibility.ELIGIBLE.value:
            ready += 1
        elif intent.automatic_eligibility == AutomaticEligibility.EXCLUDED.value:
            not_ready += 1
    return {"pages_ready": ready, "pages_not_ready": not_ready}
