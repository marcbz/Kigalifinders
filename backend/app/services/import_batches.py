"""Import batch references for research provenance."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ObservationImportBatch, RentalObservation


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _next_reference(db: AsyncSession, when: datetime | None = None) -> str:
    when = when or _now()
    base = f"DATA-{when.strftime('%m%d')}"
    existing = await db.execute(
        select(ObservationImportBatch.reference).where(ObservationImportBatch.reference.like(f"{base}%"))
    )
    refs = list(existing.scalars().all())
    if base not in refs:
        return base
    n = 2
    while f"{base}-{n}" in refs:
        n += 1
    return f"{base}-{n}"


async def record_import_batch(
    db: AsyncSession,
    *,
    rows_processed: int,
    rows_new: int,
    rows_updated: int,
    source_names: list[str] | None = None,
    period_start: date | None = None,
    period_end: date | None = None,
    notes: str | None = None,
) -> ObservationImportBatch:
    imported_at = _now()
    ref = await _next_reference(db, imported_at)
    row = ObservationImportBatch(
        id=uuid.uuid4(),
        reference=ref,
        imported_at=imported_at,
        rows_processed=rows_processed,
        rows_new=rows_new,
        rows_updated=rows_updated,
        sources=sorted({s for s in (source_names or []) if s}),
        period_start=period_start,
        period_end=period_end,
        notes=notes,
    )
    db.add(row)
    await db.flush()
    return row


async def infer_period_from_observations(db: AsyncSession) -> tuple[date | None, date | None]:
    result = await db.execute(
        select(func.min(RentalObservation.observed_at), func.max(RentalObservation.observed_at))
    )
    row = result.first()
    if not row or not row[0]:
        return None, None
    start, end = row[0], row[1]
    return start.date() if start else None, end.date() if end else None


async def list_public_import_batches(db: AsyncSession, limit: int = 12) -> list[dict[str, Any]]:
    result = await db.execute(
        select(ObservationImportBatch).order_by(ObservationImportBatch.imported_at.desc()).limit(limit)
    )
    return [
        {
            "reference": b.reference,
            "imported_at": b.imported_at.isoformat(),
            "rows_processed": b.rows_processed,
            "rows_new": b.rows_new,
            "rows_updated": b.rows_updated,
            "sources": b.sources or [],
            "period_start": b.period_start.isoformat() if b.period_start else None,
            "period_end": b.period_end.isoformat() if b.period_end else None,
        }
        for b in result.scalars().all()
    ]
