"""Manual CSV/XLSX import for market observations. Append-only."""

from __future__ import annotations

import csv
import hashlib
import io
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ObservationStatus, RentalObservation
from app.services.fx import get_default_fx_provider, store_rate, to_usd


REQUIRED_COLUMNS = {"asking_price", "currency", "source"}


def _parse_bool(val: Any) -> bool | None:
    if val is None or val == "":
        return None
    s = str(val).strip().lower()
    if s in {"1", "true", "yes", "y"}:
        return True
    if s in {"0", "false", "no", "n"}:
        return False
    return None


def _parse_dt(val: Any) -> datetime:
    if not val:
        return datetime.now(timezone.utc)
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:19], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


def make_dedupe_key(source: str, source_listing_id: str | None, source_url: str | None, neighborhood: str | None, bedrooms: Any, price: Any) -> str:
    raw = "|".join(
        [
            (source or "").lower(),
            (source_listing_id or "").lower(),
            (source_url or "").lower(),
            (neighborhood or "").lower(),
            str(bedrooms or ""),
            str(price or ""),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:40]


async def ingest_observation_rows(
    db: AsyncSession,
    rows: list[dict[str, Any]],
    *,
    default_source: str | None = None,
) -> dict:
    """Normalize, dedupe, and append structured observation dicts. Never invents data."""
    fx = await get_default_fx_provider().get_rate("USD", "RWF")
    await store_rate(db, fx)

    imported = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for i, raw in enumerate(rows, start=1):
        try:
            row = {str(k).strip().lower(): v for k, v in raw.items()}
            if row.get("asking_price") in (None, ""):
                skipped += 1
                continue
            price = float(row["asking_price"])
            currency = (str(row.get("currency") or "USD")).upper()
            source = str(row.get("source") or default_source or "").strip()
            if not source:
                errors.append(f"Row {i}: missing source")
                continue
            source_url = row.get("source_url") or None
            source_listing_id = row.get("source_listing_id") or None
            if source_url is not None:
                source_url = str(source_url)
            if source_listing_id is not None:
                source_listing_id = str(source_listing_id)
            neighborhood = row.get("neighborhood") or None
            if neighborhood is not None:
                neighborhood = str(neighborhood)
            neighborhood_slug = row.get("neighborhood_slug") or (
                (neighborhood or "").lower().replace(" ", "-") or None
            )
            bedrooms = int(row["bedrooms"]) if row.get("bedrooms") not in (None, "") else None
            bathrooms = float(row["bathrooms"]) if row.get("bathrooms") not in (None, "") else None
            observed_at = _parse_dt(row.get("observed_at"))
            status = str(row.get("observation_status") or ObservationStatus.ACTIVE_OBSERVED.value).lower()
            if status not in {s.value for s in ObservationStatus}:
                status = ObservationStatus.ACTIVE_OBSERVED.value

            dedupe = str(row.get("dedupe_key") or "") or make_dedupe_key(
                source, source_listing_id, source_url, neighborhood, bedrooms, price
            )
            existing = await db.execute(
                select(RentalObservation)
                .where(RentalObservation.dedupe_key == dedupe)
                .order_by(RentalObservation.observed_at.desc())
                .limit(1)
            )
            prev = existing.scalar_one_or_none()
            if prev and prev.asking_price == price and prev.observed_at.date() == observed_at.date():
                if prev.observation_status == status:
                    skipped += 1
                    continue

            usd = to_usd(price, currency, fx.rate)
            first_at = prev.first_observed_at if prev else observed_at
            amenities = row.get("amenities")
            if isinstance(amenities, str) and amenities.strip():
                amenities = [a.strip() for a in amenities.split(",") if a.strip()]
            elif not isinstance(amenities, list):
                amenities = None

            obs = RentalObservation(
                source=source,
                source_url=source_url,
                source_listing_id=source_listing_id,
                dedupe_key=dedupe,
                observed_at=observed_at,
                first_observed_at=first_at,
                last_observed_at=observed_at,
                property_type=str(row["property_type"]) if row.get("property_type") else None,
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                size_sqm=float(row["size_sqm"]) if row.get("size_sqm") not in (None, "") else None,
                neighborhood=neighborhood,
                neighborhood_slug=neighborhood_slug,
                district=str(row["district"]) if row.get("district") else None,
                asking_price=price,
                currency=currency,
                usd_price=round(usd, 2),
                exchange_rate=fx.rate,
                exchange_rate_date=fx.rate_date,
                exchange_rate_source=fx.source,
                is_furnished=_parse_bool(row.get("is_furnished")),
                amenities=amenities,
                rental_term=str(row["rental_term"]) if row.get("rental_term") else None,
                observation_status=status,
                confidence=float(row["confidence"]) if row.get("confidence") not in (None, "") else None,
                notes=str(row["notes"]) if row.get("notes") else None,
            )
            if prev and status == ObservationStatus.NOT_FOUND.value:
                obs.notes = (obs.notes or "") + (
                    f" No longer observed on the source as of {observed_at.date().isoformat()}."
                ).strip()
            if prev and prev.asking_price != price:
                obs.observation_status = ObservationStatus.PRICE_CHANGED.value
                updated += 1
            else:
                imported += 1
            db.add(obs)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Row {i}: {exc}")

    await db.flush()
    return {
        "found": imported + updated + skipped,
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:50],
    }


async def import_observations_csv(db: AsyncSession, content: bytes | str) -> dict:
    text = content.decode("utf-8-sig") if isinstance(content, bytes) else content
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return {"imported": 0, "skipped": 0, "errors": ["Empty CSV"], "updated": 0, "found": 0}
    fields = {f.strip().lower() for f in reader.fieldnames}
    missing = REQUIRED_COLUMNS - fields
    if missing:
        return {
            "imported": 0,
            "skipped": 0,
            "updated": 0,
            "found": 0,
            "errors": [f"Missing columns: {', '.join(sorted(missing))}"],
        }

    rows = []
    for raw in reader:
        row = {k.strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in raw.items() if k}
        rows.append(row)
    return await ingest_observation_rows(db, rows)


async def list_observations(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 50,
    source: str | None = None,
    status: str | None = None,
) -> dict:
    from sqlalchemy import func

    q = select(RentalObservation).order_by(RentalObservation.observed_at.desc())
    count_q = select(func.count()).select_from(RentalObservation)
    if source:
        q = q.where(RentalObservation.source.ilike(f"%{source}%"))
        count_q = count_q.where(RentalObservation.source.ilike(f"%{source}%"))
    if status:
        q = q.where(RentalObservation.observation_status == status)
        count_q = count_q.where(RentalObservation.observation_status == status)
    total = int((await db.execute(count_q)).scalar() or 0)
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    rows = list(result.scalars().all())
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": str(r.id),
                "source": r.source,
                "source_url": r.source_url,
                "source_listing_id": r.source_listing_id,
                "observed_at": r.observed_at.isoformat() if r.observed_at else None,
                "last_observed_at": r.last_observed_at.isoformat() if r.last_observed_at else None,
                "neighborhood": r.neighborhood,
                "neighborhood_slug": r.neighborhood_slug,
                "bedrooms": r.bedrooms,
                "bathrooms": r.bathrooms,
                "property_type": r.property_type,
                "asking_price": r.asking_price,
                "currency": r.currency,
                "usd_price": r.usd_price,
                "is_furnished": r.is_furnished,
                "observation_status": r.observation_status,
                "confidence": r.confidence,
                "notes": r.notes,
                "data_label": "External Market Observations",
            }
            for r in rows
        ],
    }


async def bulk_update_observations(
    db: AsyncSession,
    ids: list[str],
    *,
    action: str,
) -> dict:
    from uuid import UUID

    if not ids:
        return {"updated": 0, "action": action}
    uuids = [UUID(i) for i in ids]
    result = await db.execute(select(RentalObservation).where(RentalObservation.id.in_(uuids)))
    rows = list(result.scalars().all())
    updated = 0
    for row in rows:
        if action == "mark_invalid":
            row.observation_status = ObservationStatus.INVALID.value
            row.notes = ((row.notes or "") + " Marked invalid by admin.").strip()
            updated += 1
        elif action == "mark_not_found":
            row.observation_status = ObservationStatus.NOT_FOUND.value
            row.notes = (
                (row.notes or "")
                + f" No longer observed on the source as of {datetime.now(timezone.utc).date().isoformat()}."
            ).strip()
            updated += 1
        elif action == "mark_active":
            row.observation_status = ObservationStatus.ACTIVE_OBSERVED.value
            updated += 1
        elif action == "mark_unknown":
            row.observation_status = ObservationStatus.UNKNOWN.value
            updated += 1
    await db.flush()
    return {"updated": updated, "action": action}
