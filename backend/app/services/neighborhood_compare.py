"""Head-to-head neighborhood rent comparisons ("Kibagabaga vs Nyarutarama").

Built from the same combined verified + external dataset as the research hub, so
comparison pages never contradict the headline figures.
"""

from __future__ import annotations

from datetime import date
from itertools import combinations
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ListingType, Neighborhood, Property, PropertyStatusEnum
from app.services.combined_market import (
    MIN_SAMPLE_PUBLIC,
    _filter_rows,
    _furnished_breakdown,
    _group_stats,
    load_combined_rows,
)
from app.services.market_estimator import estimate_typical_rent

# A neighborhood needs at least this many observations to appear in comparisons.
MIN_COMPARE_SAMPLE = 5
MAX_COMPARE_NEIGHBORHOODS = 14
SIMILAR_PRICE_PCT = 7.0
PAIR_SEPARATOR = "-vs-"


def canonical_pair_slug(a: str, b: str) -> str:
    first, second = sorted([a.lower(), b.lower()])
    return f"{first}{PAIR_SEPARATOR}{second}"


def parse_pair_slug(pair: str) -> tuple[str, str] | None:
    parts = pair.lower().split(PAIR_SEPARATOR)
    if len(parts) != 2 or not all(parts) or parts[0] == parts[1]:
        return None
    return parts[0], parts[1]


def _bedroom_bucket(row: dict[str, Any]) -> int | None:
    beds = row.get("bedrooms")
    if beds is None:
        return None
    return min(max(int(beds), 1), 4)


def _bedroom_label(beds: int) -> str:
    return "4+ bedrooms" if beds >= 4 else f"{beds} bedroom" + ("s" if beds > 1 else "")


def build_profile(rows: list[dict[str, Any]], slug: str, listings: list[dict[str, Any]] | None = None) -> dict[str, Any] | None:
    hood = _filter_rows(rows, location_slug=slug)
    overall = estimate_typical_rent(hood, min_sample=MIN_SAMPLE_PUBLIC)
    if not overall or overall["sample_size"] < MIN_COMPARE_SAMPLE:
        return None

    by_bedroom = _group_stats(hood, key_fn=_bedroom_bucket, label_fn=lambda k, _g: _bedroom_label(k))
    furnished = _furnished_breakdown(hood)
    known_furnishing = [r for r in hood if r.get("is_furnished") is not None]
    furnished_share = (
        round(100 * sum(1 for r in known_furnishing if r["is_furnished"]) / len(known_furnishing))
        if known_furnishing
        else None
    )

    listings = listings or []

    def share(flag: str) -> int | None:
        if not listings:
            return None
        return round(100 * sum(1 for item in listings if item.get(flag)) / len(listings))

    return {
        "slug": slug,
        "name": hood[0].get("location_name") or slug.replace("-", " ").title(),
        "typical_usd": overall["median_usd"],
        "p25_usd": overall["p25_usd"],
        "p75_usd": overall["p75_usd"],
        "sample_size": overall["sample_size"],
        "verified_count": sum(1 for r in hood if r.get("origin") == "verified"),
        "external_count": sum(1 for r in hood if r.get("origin") == "external"),
        "furnished_share_pct": furnished_share,
        "furnished_median_usd": furnished["furnished"]["median_usd"],
        "unfurnished_median_usd": furnished["unfurnished"]["median_usd"],
        "by_bedroom": {
            int(g["key"]): {"median_usd": g["median_usd"], "sample_size": g["sample_size"]} for g in by_bedroom
        },
        "active_listings": len(listings),
        "amenities": {
            "pool_pct": share("has_pool"),
            "garden_pct": share("has_garden"),
            "parking_pct": share("has_parking"),
        },
    }


def _pct_diff(low: float, high: float) -> float:
    return 100 * (high - low) / high if high else 0.0


def _money(value: float | None) -> str:
    return f"${value:,.0f}" if value is not None else "n/a"


def build_comparison(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    cheaper, pricier = sorted([a, b], key=lambda p: p["typical_usd"])
    diff = _pct_diff(cheaper["typical_usd"], pricier["typical_usd"])
    similar = diff < SIMILAR_PRICE_PCT

    if similar:
        price_line = (
            f"{a['name']} and {b['name']} are similarly priced: typical asking rent is "
            f"{_money(a['typical_usd'])} vs {_money(b['typical_usd'])} per month."
        )
    else:
        price_line = (
            f"{cheaper['name']} is about {diff:.0f}% cheaper than {pricier['name']}: typical asking rent is "
            f"{_money(cheaper['typical_usd'])} vs {_money(pricier['typical_usd'])} per month."
        )

    bedroom_rows = []
    for beds in sorted(set(a["by_bedroom"]) | set(b["by_bedroom"])):
        ra, rb = a["by_bedroom"].get(beds), b["by_bedroom"].get(beds)
        bedroom_rows.append(
            {
                "bedrooms": beds,
                "label": _bedroom_label(beds),
                "a_median_usd": ra["median_usd"] if ra else None,
                "a_sample_size": ra["sample_size"] if ra else 0,
                "b_median_usd": rb["median_usd"] if rb else None,
                "b_sample_size": rb["sample_size"] if rb else 0,
            }
        )

    summary = [price_line]
    matched = [r for r in bedroom_rows if r["a_median_usd"] and r["b_median_usd"]]
    if matched:
        r = max(matched, key=lambda x: x["a_sample_size"] + x["b_sample_size"])
        low_name, low_val, high_name, high_val = (
            (a["name"], r["a_median_usd"], b["name"], r["b_median_usd"])
            if r["a_median_usd"] <= r["b_median_usd"]
            else (b["name"], r["b_median_usd"], a["name"], r["a_median_usd"])
        )
        summary.append(
            f"For {r['label'].lower()}, the most common size in both areas, {low_name} averages "
            f"{_money(low_val)} vs {_money(high_val)} in {high_name}."
        )
    if a["furnished_share_pct"] is not None and b["furnished_share_pct"] is not None:
        more = a if a["furnished_share_pct"] >= b["furnished_share_pct"] else b
        less = b if more is a else a
        if more["furnished_share_pct"] - less["furnished_share_pct"] >= 10:
            summary.append(
                f"Furnished homes are more common in {more['name']} ({more['furnished_share_pct']}% of listings) "
                f"than in {less['name']} ({less['furnished_share_pct']}%)."
            )
    bigger = a if a["sample_size"] >= b["sample_size"] else b
    smaller = b if bigger is a else a
    if bigger["sample_size"] >= 1.5 * smaller["sample_size"]:
        summary.append(
            f"{bigger['name']} has a deeper rental market, with {bigger['sample_size']} recent asking rents "
            f"observed vs {smaller['sample_size']} in {smaller['name']}."
        )

    faqs = [
        {
            "question": f"Is {cheaper['name']} cheaper than {pricier['name']} to rent?",
            "answer": price_line,
        },
        {
            "question": f"How much is rent in {a['name']}?",
            "answer": (
                f"Typical asking rent in {a['name']} is {_money(a['typical_usd'])}/month, and most listings ask "
                f"between {_money(a['p25_usd'])} and {_money(a['p75_usd'])}."
            ),
        },
        {
            "question": f"How much is rent in {b['name']}?",
            "answer": (
                f"Typical asking rent in {b['name']} is {_money(b['typical_usd'])}/month, and most listings ask "
                f"between {_money(b['p25_usd'])} and {_money(b['p75_usd'])}."
            ),
        },
    ]

    return {
        "slug": canonical_pair_slug(a["slug"], b["slug"]),
        "a": a,
        "b": b,
        "cheaper_slug": None if similar else cheaper["slug"],
        "price_difference_pct": round(diff, 1),
        "bedroom_rows": bedroom_rows,
        "summary": summary,
        "faqs": faqs,
        "last_updated": date.today().isoformat(),
        "note": "Asking rents from verified Kigali Rent listings and external market observations, not signed leases.",
    }


def eligible_slugs(rows: list[dict[str, Any]]) -> list[str]:
    counts: dict[str, int] = {}
    for r in rows:
        slug = (r.get("location_slug") or "").lower()
        if slug and slug not in {"kigali", "all"}:
            counts[slug] = counts.get(slug, 0) + 1
    ranked = sorted((s for s, n in counts.items() if n >= MIN_COMPARE_SAMPLE), key=lambda s: -counts[s])
    profiles = [s for s in ranked if build_profile(rows, s)]
    return profiles[:MAX_COMPARE_NEIGHBORHOODS]


async def _listing_flags(db: AsyncSession, slugs: list[str]) -> dict[str, list[dict[str, Any]]]:
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.neighborhood))
        .join(Neighborhood, Property.neighborhood_id == Neighborhood.id)
        .where(
            Property.status == PropertyStatusEnum.PUBLISHED,
            Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]),
            Neighborhood.slug.in_(slugs),
        )
    )
    out: dict[str, list[dict[str, Any]]] = {s: [] for s in slugs}
    for p in result.scalars().all():
        out[p.neighborhood.slug].append(
            {"has_pool": p.has_pool, "has_garden": p.has_garden, "has_parking": p.has_parking}
        )
    return out


async def list_comparison_pairs(db: AsyncSession) -> list[dict[str, Any]]:
    rows = await load_combined_rows(db)
    slugs = eligible_slugs(rows)
    profiles = {s: build_profile(rows, s) for s in slugs}
    pairs = []
    for x, y in combinations(slugs, 2):
        px, py = profiles[x], profiles[y]
        first, second = sorted([px, py], key=lambda p: p["slug"])
        pairs.append(
            {
                "slug": canonical_pair_slug(x, y),
                "a": {"slug": first["slug"], "name": first["name"], "typical_usd": first["typical_usd"]},
                "b": {"slug": second["slug"], "name": second["name"], "typical_usd": second["typical_usd"]},
                "sample_size": px["sample_size"] + py["sample_size"],
            }
        )
    pairs.sort(key=lambda p: -p["sample_size"])
    return pairs


async def get_comparison(db: AsyncSession, pair: str) -> dict[str, Any] | None:
    parsed = parse_pair_slug(pair)
    if not parsed:
        return None
    first, second = sorted(parsed)
    rows = await load_combined_rows(db)
    eligible = eligible_slugs(rows)
    if first not in eligible or second not in eligible:
        return None
    flags = await _listing_flags(db, [first, second])
    a = build_profile(rows, first, flags.get(first))
    b = build_profile(rows, second, flags.get(second))
    if not a or not b:
        return None
    return build_comparison(a, b)
