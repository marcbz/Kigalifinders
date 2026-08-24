"""Registry of external market observation sources (CSV/manual import only)."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ExternalMarketSource, RentalObservation, SourcePolicyStatus


@dataclass(frozen=True)
class MarketSource:
    id: str
    name: str
    base_url: str
    notes: str
    preferred_ingest: str = "csv"


SOURCES: list[MarketSource] = [
    MarketSource(
        id="house_in_rwanda",
        name="House in Rwanda",
        base_url="https://www.houseinrwanda.com",
        notes="CSV/manual import only. Include source + source_url on every row.",
    ),
    MarketSource(
        id="kigali_property",
        name="Kigali Property",
        base_url="https://www.kigaliproperty.com",
        notes="CSV/manual import only. Include source + source_url on every row.",
    ),
    MarketSource(
        id="kigali_list",
        name="Kigali List",
        base_url="https://kigalilist.com",
        notes="CSV/manual import only. Include source + source_url on every row.",
    ),
    MarketSource(
        id="vibe_rw",
        name="Vibe Real Estate",
        base_url="https://vibe.rw",
        notes="CSV/manual import only. Include source + source_url on every row.",
    ),
    MarketSource(
        id="manual_other",
        name="Other permitted public sources",
        base_url="",
        notes="Operator-supplied CSV with source attribution and URL required.",
    ),
]


def list_sources() -> list[dict[str, Any]]:
    return [asdict(s) for s in SOURCES]


def get_source(source_id: str) -> MarketSource | None:
    for s in SOURCES:
        if s.id == source_id:
            return s
    return None


async def ensure_source_rows(db: AsyncSession) -> list[ExternalMarketSource]:
    result = await db.execute(select(ExternalMarketSource))
    existing = {r.source_id: r for r in result.scalars().all()}
    rows: list[ExternalMarketSource] = []
    for src in SOURCES:
        row = existing.get(src.id)
        if not row:
            row = ExternalMarketSource(
                source_id=src.id,
                name=src.name,
                base_url=src.base_url or None,
                robots_url=None,
                preferred_ingest="csv",
                collection_method="csv",
                policy_status=SourcePolicyStatus.REVIEWED_RESTRICTED.value,
                listing_adapter_ready=False,
                automated_enabled=False,
                policy_notes=src.notes,
            )
            db.add(row)
        else:
            row.name = src.name
            row.base_url = src.base_url or None
            row.preferred_ingest = "csv"
            row.collection_method = "csv"
            row.automated_enabled = False
            row.listing_adapter_ready = False
            if not row.policy_notes:
                row.policy_notes = src.notes
        rows.append(row)
    await db.flush()
    return rows


async def refresh_observation_counts(db: AsyncSession) -> None:
    rows = await ensure_source_rows(db)
    for row in rows:
        result = await db.execute(
            select(func.count())
            .select_from(RentalObservation)
            .where(
                or_(
                    RentalObservation.source == row.source_id,
                    RentalObservation.source.ilike(row.name),
                )
            )
        )
        row.observation_count = int(result.scalar() or 0)
    await db.flush()


def _serialize_source(row: ExternalMarketSource) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "source_id": row.source_id,
        "name": row.name,
        "base_url": row.base_url,
        "collection_method": "CSV",
        "policy_notes": row.policy_notes,
        "last_import_at": row.last_import_at.isoformat() if row.last_import_at else None,
        "observation_count": row.observation_count,
        "last_error": row.last_error,
    }


async def list_source_dashboard(db: AsyncSession) -> dict[str, Any]:
    await ensure_source_rows(db)
    await refresh_observation_counts(db)
    result = await db.execute(select(ExternalMarketSource).order_by(ExternalMarketSource.name.asc()))
    rows = list(result.scalars().all())
    return {
        "policy": (
            "External Market Observations are CSV/manual import only — completely separate from "
            "KigaliRent Verified inventory. Every row needs source + source_url. "
            "Disappeared listings are never assumed rented."
        ),
        "required_columns": sorted(
            {"asking_price", "currency", "source", "source_url"}
        ),
        "recommended_columns": [
            "source",
            "source_url",
            "source_listing_id",
            "observed_at",
            "property_type",
            "bedrooms",
            "bathrooms",
            "neighborhood",
            "neighborhood_slug",
            "asking_price",
            "currency",
            "is_furnished",
            "amenities",
            "observation_status",
            "notes",
        ],
        "sources": [_serialize_source(r) for r in rows],
    }


async def get_source_row(db: AsyncSession, source_id: str) -> ExternalMarketSource | None:
    await ensure_source_rows(db)
    result = await db.execute(
        select(ExternalMarketSource).where(ExternalMarketSource.source_id == source_id)
    )
    return result.scalar_one_or_none()


async def touch_source_import(db: AsyncSession, source_id: str | None) -> None:
    if not source_id:
        return
    row = await get_source_row(db, source_id)
    if row:
        row.last_import_at = datetime.now(timezone.utc)
        row.last_error = None
        row.consecutive_errors = 0
        await db.flush()
