"""Registry + DB control plane for external market observation sources.

Crawlers stay disabled until each source is explicitly reviewed and enabled.
Default ingest path: CSV/manual import. Never fabricate listings.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.robotparser import RobotFileParser

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ExternalMarketSource, RentalObservation, SourcePolicyStatus


@dataclass(frozen=True)
class MarketSource:
    id: str
    name: str
    base_url: str
    robots_url: str
    crawl_allowed_default: bool
    preferred_ingest: str  # csv | crawler | both
    notes: str
    stores: str = "structured fields only — no competitor images, full descriptions, or contacts"
    # Listing HTML parsers are OFF until deliberately approved per source.
    listing_adapter_ready: bool = False


SOURCES: list[MarketSource] = [
    MarketSource(
        id="house_in_rwanda",
        name="House in Rwanda",
        base_url="https://www.houseinrwanda.com",
        robots_url="https://www.houseinrwanda.com/robots.txt",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes=(
            "robots.txt (reviewed 2026-08-24) disallows /admin/, /search/, auth paths; "
            "does not blanket-disallow listing pages. Still: no CAPTCHA/login bypass; "
            "low concurrency; prefer CSV until listing adapter + terms sign-off."
        ),
    ),
    MarketSource(
        id="kigali_property",
        name="Kigali Property",
        base_url="https://www.kigaliproperty.com",
        robots_url="https://www.kigaliproperty.com/robots.txt",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes="Use CSV/manual import until robots/terms reviewed and crawl explicitly enabled.",
    ),
    MarketSource(
        id="kigali_list",
        name="Kigali List",
        base_url="https://kigalilist.com",
        robots_url="https://kigalilist.com/robots.txt",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes="Use CSV/manual import until robots/terms reviewed and crawl explicitly enabled.",
    ),
    MarketSource(
        id="vibe_rw",
        name="Vibe Real Estate",
        base_url="https://vibe.rw",
        robots_url="https://vibe.rw/robots.txt",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes="Use CSV/manual import until robots/terms reviewed and crawl explicitly enabled.",
    ),
    MarketSource(
        id="manual_other",
        name="Other permitted public sources",
        base_url="",
        robots_url="",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes="Operator-supplied CSV with source attribution and URL required. No automated crawl.",
    ),
]

USER_AGENT = "KigaliRentResearchBot/1.0 (+https://kigalirent.com/research/kigali-rental-market/methodology/)"
MAX_CONSECUTIVE_ERRORS_BEFORE_PAUSE = 3


def list_sources() -> list[dict[str, Any]]:
    return [asdict(s) for s in SOURCES]


def get_source(source_id: str) -> MarketSource | None:
    for s in SOURCES:
        if s.id == source_id:
            return s
    return None


async def ensure_source_rows(db: AsyncSession) -> list[ExternalMarketSource]:
    """Upsert registry definitions into DB control rows."""
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
                robots_url=src.robots_url or None,
                preferred_ingest=src.preferred_ingest,
                collection_method="csv",
                policy_status=SourcePolicyStatus.NOT_REVIEWED.value,
                listing_adapter_ready=src.listing_adapter_ready,
                policy_notes=src.notes,
            )
            db.add(row)
        else:
            row.name = src.name
            row.base_url = src.base_url or None
            row.robots_url = src.robots_url or None
            row.preferred_ingest = src.preferred_ingest
            row.listing_adapter_ready = src.listing_adapter_ready
            if not row.policy_notes:
                row.policy_notes = src.notes
        rows.append(row)
    await db.flush()
    return rows


async def refresh_observation_counts(db: AsyncSession) -> None:
    from sqlalchemy import or_

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
    can_enable = row.policy_status in {
        SourcePolicyStatus.REVIEWED_OK.value,
        SourcePolicyStatus.REVIEWED_RESTRICTED.value,
    } and bool(row.base_url)
    return {
        "id": str(row.id),
        "source_id": row.source_id,
        "name": row.name,
        "base_url": row.base_url,
        "robots_url": row.robots_url,
        "preferred_ingest": row.preferred_ingest,
        "collection_method": "Automated" if row.automated_enabled else "CSV",
        "policy_status": row.policy_status,
        "policy_notes": row.policy_notes,
        "robots_summary": row.robots_summary,
        "robots_checked_at": row.robots_checked_at.isoformat() if row.robots_checked_at else None,
        "automated_enabled": row.automated_enabled,
        "listing_adapter_ready": row.listing_adapter_ready,
        "can_enable_automated": can_enable and row.source_id != "manual_other",
        "can_run_now": bool(row.automated_enabled and row.base_url),
        "last_crawl_at": row.last_crawl_at.isoformat() if row.last_crawl_at else None,
        "last_import_at": row.last_import_at.isoformat() if row.last_import_at else None,
        "last_error": row.last_error,
        "consecutive_errors": row.consecutive_errors,
        "observation_count": row.observation_count,
        "csv_only": not row.automated_enabled,
    }


async def list_source_dashboard(db: AsyncSession) -> dict[str, Any]:
    await ensure_source_rows(db)
    await refresh_observation_counts(db)
    result = await db.execute(select(ExternalMarketSource).order_by(ExternalMarketSource.name.asc()))
    rows = list(result.scalars().all())
    return {
        "policy": (
            "Automated crawls remain disabled by default. Review robots/terms, then enable per source. "
            "Never bypass CAPTCHA, login, paywalls, or anti-bot systems. "
            "Disappeared listings → not_found/unknown — never assumed rented. "
            "CSV import is always available. Listing HTML adapters stay off until explicitly approved."
        ),
        "sources": [_serialize_source(r) for r in rows],
    }


async def get_source_row(db: AsyncSession, source_id: str) -> ExternalMarketSource | None:
    await ensure_source_rows(db)
    result = await db.execute(
        select(ExternalMarketSource).where(ExternalMarketSource.source_id == source_id)
    )
    return result.scalar_one_or_none()


async def review_source(db: AsyncSession, source_id: str) -> dict[str, Any]:
    """Fetch robots.txt and update policy review status. Does not enable crawling."""
    row = await get_source_row(db, source_id)
    if not row:
        raise ValueError("Unknown source")
    if not row.robots_url and not row.base_url:
        row.policy_status = SourcePolicyStatus.REVIEWED_RESTRICTED.value
        row.robots_summary = "No public site URL — CSV/manual import only."
        row.robots_checked_at = datetime.now(timezone.utc)
        row.automated_enabled = False
        row.collection_method = "csv"
        await db.flush()
        return _serialize_source(row)

    robots_url = row.robots_url or f"{(row.base_url or '').rstrip('/')}/robots.txt"
    summary_parts: list[str] = []
    policy = SourcePolicyStatus.REVIEWED_OK.value
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            res = await client.get(robots_url, headers={"User-Agent": USER_AGENT})
            row.robots_checked_at = datetime.now(timezone.utc)
            if res.status_code == 404:
                summary_parts.append("robots.txt not found (404). Treat as cautious — prefer CSV.")
                policy = SourcePolicyStatus.REVIEWED_RESTRICTED.value
            elif res.status_code == 429:
                summary_parts.append("HTTP 429 fetching robots.txt — pause and prefer CSV.")
                policy = SourcePolicyStatus.BLOCKED.value
                row.last_error = "HTTP 429 while reviewing robots.txt"
                row.consecutive_errors = (row.consecutive_errors or 0) + 1
            elif res.status_code >= 400:
                summary_parts.append(f"robots.txt HTTP {res.status_code}. Prefer CSV until resolved.")
                policy = SourcePolicyStatus.REVIEWED_RESTRICTED.value
            else:
                text = res.text[:8000]
                rp = RobotFileParser()
                rp.parse(text.splitlines())
                base = (row.base_url or "").rstrip("/") + "/"
                can_root = rp.can_fetch(USER_AGENT, base) if base else True
                summary_parts.append(f"robots.txt fetched ({len(text)} chars).")
                summary_parts.append(f"Root fetch allowed for bot: {can_root}.")
                # Capture disallow hints without storing full competitor content
                disallow_lines = [
                    ln.strip() for ln in text.splitlines() if ln.strip().lower().startswith("disallow:")
                ][:25]
                if disallow_lines:
                    summary_parts.append("Sample Disallow rules: " + "; ".join(disallow_lines))
                if not can_root:
                    policy = SourcePolicyStatus.BLOCKED.value
                    summary_parts.append("Root disallowed for our user-agent — automated collection must stay off.")
                else:
                    policy = SourcePolicyStatus.REVIEWED_OK.value
                    summary_parts.append(
                        "Robots review recorded. Automated collection still requires explicit Enable."
                    )
            row.robots_summary = " ".join(summary_parts)
            row.policy_status = policy
            if policy == SourcePolicyStatus.BLOCKED.value:
                row.automated_enabled = False
                row.collection_method = "csv"
            row.last_error = None if policy != SourcePolicyStatus.BLOCKED.value else row.last_error
    except Exception as exc:  # noqa: BLE001
        row.policy_status = SourcePolicyStatus.REVIEWED_RESTRICTED.value
        row.robots_summary = f"robots.txt review failed: {exc}. Prefer CSV."
        row.robots_checked_at = datetime.now(timezone.utc)
        row.last_error = str(exc)
        row.consecutive_errors = (row.consecutive_errors or 0) + 1
        row.automated_enabled = False
        row.collection_method = "csv"

    await db.flush()
    return _serialize_source(row)


async def set_automated_enabled(db: AsyncSession, source_id: str, enabled: bool) -> dict[str, Any]:
    row = await get_source_row(db, source_id)
    if not row:
        raise ValueError("Unknown source")
    if source_id == "manual_other" and enabled:
        raise ValueError("Other permitted sources are CSV-only")
    if enabled:
        if row.policy_status == SourcePolicyStatus.NOT_REVIEWED.value:
            raise ValueError("Review source (robots/policy) before enabling automated collection")
        if row.policy_status == SourcePolicyStatus.BLOCKED.value:
            raise ValueError("Source is blocked by robots/policy — CSV only")
        if not row.base_url:
            raise ValueError("No base URL — CSV only")
        if (row.consecutive_errors or 0) >= MAX_CONSECUTIVE_ERRORS_BEFORE_PAUSE:
            raise ValueError("Too many consecutive errors — fix last_error / re-review before enabling")
        row.automated_enabled = True
        row.collection_method = "automated"
        row.last_error = None
    else:
        row.automated_enabled = False
        row.collection_method = "csv"
    await db.flush()
    return _serialize_source(row)
