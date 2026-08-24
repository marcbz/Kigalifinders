"""Research transparency, combined counts, and citation metadata."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ExternalMarketSource,
    ListingType,
    MarketDataKind,
    MarketStatSnapshot,
    Property,
    PropertyStatusEnum,
    RentalObservation,
)
from app.services.import_batches import list_public_import_batches


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def verified_listing_count(db: AsyncSession) -> int:
    return int(
        (
            await db.execute(
                select(func.count())
                .select_from(Property)
                .where(
                    Property.status == PropertyStatusEnum.PUBLISHED,
                    Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]),
                )
            )
        ).scalar()
        or 0
    )


async def external_observation_count(db: AsyncSession) -> int:
    return int(
        (
            await db.execute(
                select(func.count())
                .select_from(RentalObservation)
                .where(
                    RentalObservation.observation_status.in_(["active_observed", "price_changed"]),
                    RentalObservation.usd_price.is_not(None),
                )
            )
        ).scalar()
        or 0
    )


async def combined_research_counts(db: AsyncSession) -> dict[str, int]:
    verified = await verified_listing_count(db)
    external = await external_observation_count(db)
    return {
        "verified_count": verified,
        "external_count": external,
        "total_count": verified + external,
    }


def combined_summary_line(*, verified_count: int, external_count: int) -> str:
    total = verified_count + external_count
    if total == 0:
        return "Research data is updated as verified listings and external observations are added."
    return (
        f"Based on {total} rental data point{'s' if total != 1 else ''}: "
        f"{verified_count} KigaliRent Verified + {external_count} external observation{'s' if external_count != 1 else ''}."
    )


async def research_source_attribution(db: AsyncSession) -> list[dict[str, Any]]:
    from app.services.market_sources import ensure_source_rows

    await ensure_source_rows(db)
    src_rows = list((await db.execute(select(ExternalMarketSource))).scalars().all())
    counts = {
        s: int(c)
        for s, c in (
            await db.execute(
                select(RentalObservation.source, func.count())
                .where(RentalObservation.observation_status.in_(["active_observed", "price_changed"]))
                .group_by(RentalObservation.source)
            )
        ).all()
    }
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in src_rows:
        if row.policy_status == "blocked":
            continue
        count = counts.get(row.source_id, 0) + counts.get(row.name, 0)
        if count <= 0 and row.observation_count <= 0:
            continue
        display_count = max(count, row.observation_count)
        out.append(
            {
                "name": row.name,
                "source_key": row.source_id,
                "observation_count": display_count,
                "source_url": row.base_url,
                "kind": "market_observation",
            }
        )
        seen.add(row.source_id)
        seen.add(row.name)
    for key, count in counts.items():
        if key in seen:
            continue
        out.append({"name": key, "source_key": key, "observation_count": count, "source_url": None, "kind": "market_observation"})
    out.sort(key=lambda x: -x["observation_count"])
    return out


async def research_last_updated(db: AsyncSession) -> date | None:
    snap = (
        await db.execute(
            select(MarketStatSnapshot.period_end)
            .order_by(MarketStatSnapshot.period_end.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if snap:
        return snap
    obs = (await db.execute(select(func.max(RentalObservation.observed_at)))).scalar()
    return obs.date() if obs else None


async def research_transparency(
    db: AsyncSession,
    *,
    page_title: str = "Kigali Rental Market Research",
    canonical_url: str = "https://kigalirent.com/research/kigali-rental-market",
) -> dict[str, Any]:
    counts = await combined_research_counts(db)
    sources = await research_source_attribution(db)
    last = await research_last_updated(db)
    batches = await list_public_import_batches(db, limit=8)
    limitations = [
        "External observations are not verified vacancies and may no longer be available.",
        "Disappeared external listings are marked not found — never assumed rented.",
        "Statistics are withheld when sample sizes are too small to be meaningful.",
        "Verified KigaliRent inventory and external observations are never merged without labels.",
    ]
    return {
        "page_title": page_title,
        "canonical_url": canonical_url,
        "last_updated": last.isoformat() if last else None,
        "last_updated_display": last.strftime("%b %d, %Y") if last else None,
        "verified_count": counts["verified_count"],
        "external_count": counts["external_count"],
        "total_count": counts["total_count"],
        "combined_summary": combined_summary_line(
            verified_count=counts["verified_count"],
            external_count=counts["external_count"],
        ),
        "verified_label": "KigaliRent Verified",
        "external_label": "External Market Observations",
        "sources": sources,
        "import_batches": batches,
        "limitations": limitations,
        "methodology_url": "https://kigalirent.com/research/kigali-rental-market/methodology",
        "sources_url": "https://kigalirent.com/research/kigali-rental-market/sources",
        "citation_text": (
            f'KigaliRent. "{page_title}." KigaliRent Research, '
            f'{last.strftime("%Y") if last else "n.d."}, '
            f'{canonical_url}. Accessed { _now().strftime("%b %d, %Y") }. '
            f'Data: {counts["verified_count"]} KigaliRent Verified + {counts["external_count"]} external observations.'
        ),
    }
