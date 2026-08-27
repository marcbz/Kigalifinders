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
    """Plain-English meaningful search filters (location, beds, type, budget, amenities, …)."""
    from app.services.seo_attributes import sanitize_seo_amenities

    q = normalize_query(query)
    attrs: list[str] = []
    loc = q.get("location", "kigali")
    if loc and loc != "kigali":
        attrs.append(loc.replace("-", " ").title())
    elif loc == "kigali" or q.get("location_slug") == "kigali":
        attrs.append("Kigali")
    elif q.get("location") or q.get("location_slug"):
        attrs.append(str(loc).replace("-", " ").title())

    if q.get("bedrooms") is not None:
        n = int(q["bedrooms"])
        attrs.append(f"{n} bedroom" if n == 1 else f"{n} bedrooms")
    if q.get("bathrooms") is not None:
        baths = q["bathrooms"]
        label = str(int(baths)) if float(baths).is_integer() else str(baths)
        n = float(baths)
        attrs.append(f"{label} bathroom" if n == 1 else f"{label} bathrooms")
    if q.get("furnished") is True:
        attrs.append("Furnished")
    elif q.get("furnished") is False:
        attrs.append("Unfurnished")
    ptype = q.get("property_type")
    if ptype:
        attrs.append(ptype.replace("-", " ").title())
    allowed, _ = sanitize_seo_amenities(q.get("amenities") or [])
    for a in allowed:
        attrs.append(str(a).replace("_", " ").capitalize())
    if q.get("max_price_usd") is not None:
        attrs.append(f"Under ${int(q['max_price_usd']):,}/month")
    if q.get("min_price_usd") is not None and q.get("max_price_usd") is None:
        attrs.append(f"From ${int(q['min_price_usd']):,}/month")
    return attrs


def filters_label_from_query(query: dict[str, Any]) -> str:
    return " · ".join(key_attributes_from_query(query))


def generate_display_description(
    query: dict[str, Any],
    *,
    location_name: str | None = None,
) -> str:
    """Short, intent-led hub description for display (not listing counts)."""
    q = normalize_query(query)
    loc_slug = (q.get("location") or "kigali").lower()
    loc = location_name or (
        loc_slug.replace("-", " ").title() if loc_slug != "kigali" else "Kigali"
    )
    loc_phrase = loc if loc.lower() == "kigali" else f"{loc}, Kigali"

    beds = q.get("bedrooms")
    ptype = (q.get("property_type") or "").replace("-", " ").strip().lower() or None
    furnished = q.get("furnished")
    max_usd = q.get("max_price_usd")
    min_usd = q.get("min_price_usd") if q.get("max_price_usd") is None else None

    type_phrase = None
    if ptype:
        plural = ptype if ptype.endswith("s") else f"{ptype}s"
        if furnished is True:
            type_phrase = f"furnished {plural}"
        elif furnished is False:
            type_phrase = f"unfurnished {plural}"
        else:
            type_phrase = plural
    elif furnished is True:
        type_phrase = "furnished rentals"
    elif furnished is False:
        type_phrase = "unfurnished rentals"

    bed_phrase = None
    if beds is not None:
        n = int(beds)
        bed_phrase = f"{n}-bedroom" if n != 1 else "1-bedroom"

    budget_phrase = None
    if max_usd is not None:
        budget_phrase = f"priced under ${int(max_usd):,} per month"
    elif min_usd is not None:
        budget_phrase = f"from ${int(min_usd):,} per month"

    if bed_phrase and type_phrase:
        lead = f"Browse available {bed_phrase} {type_phrase} for rent in {loc_phrase}"
    elif type_phrase and furnished is True and ptype and "apartment" in ptype:
        return (
            f"Find furnished apartments for rent in {loc_phrase}, "
            "including move-in-ready options in popular neighborhoods."
        )
    elif type_phrase:
        lead = f"Browse available {type_phrase} for rent in {loc_phrase}"
    elif bed_phrase:
        lead = f"Browse available {bed_phrase} rentals in {loc_phrase}"
    elif loc_slug != "kigali":
        return f"Browse available houses and apartments for rent in {loc_phrase}."
    else:
        return f"Browse available houses and apartments for rent in {loc}."

    if budget_phrase:
        return f"{lead} {budget_phrase}."
    return f"{lead}."


def generate_intro_text(
    query: dict[str, Any],
    *,
    match_count: int,
    observation_count: int,
    verified_snap: dict[str, Any] | None = None,
    observation_snap: dict[str, Any] | None = None,
    location_name: str | None = None,
    market_answer: dict[str, Any] | None = None,
) -> str:
    """Prefer short display copy; market detail stays in dedicated sections."""
    return generate_display_description(query, location_name=location_name)


def build_data_insights(
    *,
    match_count: int,
    observation_count: int = 0,
    verified_snap: dict[str, Any] | None = None,
    observation_snap: dict[str, Any] | None = None,
    furnished: dict[str, int] | None = None,
    by_bedroom_verified: list[dict[str, Any]] | None = None,
    by_bedroom_external: list[dict[str, Any]] | None = None,
    market_insights: list[str] | None = None,
) -> list[str]:
    """Prefer combined market insights; fall back lightly for inventory context."""
    insights: list[str] = list(market_insights or [])
    if match_count:
        insights.append(
            f"{match_count} verified KigaliRent {'listing matches' if match_count != 1 else 'listing matches'} "
            "this search today (inventory, separate from market statistics)."
        )
    # Legacy dual-track fields ignored for public conclusions when market_insights provided
    if not market_insights:
        if verified_snap and verified_snap.get("p25_usd") and verified_snap.get("p75_usd"):
            insights.append(
                f"Middle 50% of observed asking rents: "
                f"${verified_snap['p25_usd']:,.0f}–${verified_snap['p75_usd']:,.0f}/month."
            )
        if furnished and furnished.get("total", 0) >= 3:
            insights.append(
                f"Among verified matches: {furnished['furnished']} furnished, {furnished['unfurnished']} unfurnished."
            )
        beds = by_bedroom_verified or []
        if len(beds) >= 2:
            cheapest = min(beds, key=lambda r: r.get("median_usd") or 999999)
            priciest = max(beds, key=lambda r: r.get("median_usd") or 0)
            if cheapest.get("median_usd") and priciest.get("median_usd"):
                insights.append(
                    f"By bedrooms, typical asking rents range from ${cheapest['median_usd']:,.0f}/month "
                    f"({cheapest.get('label') or cheapest.get('bedrooms')} bed) to "
                    f"${priciest['median_usd']:,.0f}/month ({priciest.get('label') or priciest.get('bedrooms')} bed)."
                )
    return insights[:8]


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
