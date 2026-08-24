"""Controlled external observation collection (CSV + polite automated runs).

Never crawls during API request handling — enqueue Celery (or in-process async worker).
Never fabricates listings. Listing HTML adapters stay off until per-source approval.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CollectionRunStatus,
    ExternalCollectionRun,
    ExternalMarketSource,
)
from app.services.crawler import CrawlerConfig, PoliteCrawler
from app.services.market_sources import (
    MAX_CONSECUTIVE_ERRORS_BEFORE_PAUSE,
    USER_AGENT,
    get_source_row,
)
from app.services.observations import ingest_observation_rows

logger = logging.getLogger(__name__)


def serialize_run(run: ExternalCollectionRun) -> dict[str, Any]:
    return {
        "id": str(run.id),
        "status": run.status,
        "mode": run.mode,
        "source_ids": run.source_ids or [],
        "current_source_id": run.current_source_id,
        "progress": run.progress or {},
        "observations_found": run.observations_found,
        "observations_new": run.observations_new,
        "observations_updated": run.observations_updated,
        "duplicates": run.duplicates,
        "errors": run.errors or [],
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


async def create_collection_run(
    db: AsyncSession,
    *,
    source_ids: list[str],
    mode: str,
) -> ExternalCollectionRun:
    run = ExternalCollectionRun(
        status=CollectionRunStatus.QUEUED.value,
        mode=mode,
        source_ids=source_ids,
        progress={"phase": "queued", "sources": source_ids},
        errors=[],
    )
    db.add(run)
    await db.flush()
    return run


async def get_run(db: AsyncSession, run_id: UUID) -> ExternalCollectionRun | None:
    return await db.get(ExternalCollectionRun, run_id)


async def list_recent_runs(db: AsyncSession, limit: int = 20) -> list[dict[str, Any]]:
    result = await db.execute(
        select(ExternalCollectionRun).order_by(ExternalCollectionRun.created_at.desc()).limit(limit)
    )
    return [serialize_run(r) for r in result.scalars().all()]


async def _post_ingest_refresh(db: AsyncSession) -> dict[str, Any]:
    from app.services.intent_automation import apply_index_rules, recalculate_all_intent_metrics
    from app.services.intent_config import load_automation_config
    from app.services.research import rebuild_observation_snapshots

    snaps = await rebuild_observation_snapshots(db)
    await recalculate_all_intent_metrics(db)
    await apply_index_rules(db, await load_automation_config(db))
    return {"observation_snapshots": snaps}


async def collect_one_source(db: AsyncSession, row: ExternalMarketSource, run: ExternalCollectionRun) -> dict[str, Any]:
    """Polite automated collection for one enabled source.

    Without an approved listing adapter, only connectivity/robots checks run —
    no fabricated observation rows.
    """
    stats = {
        "source_id": row.source_id,
        "found": 0,
        "new": 0,
        "updated": 0,
        "duplicates": 0,
        "errors": [],
        "note": None,
    }
    if not row.automated_enabled:
        stats["errors"].append("Source not enabled for automated collection")
        return stats
    if not row.base_url:
        stats["errors"].append("No base URL")
        return stats
    if (row.consecutive_errors or 0) >= MAX_CONSECUTIVE_ERRORS_BEFORE_PAUSE:
        stats["errors"].append("Paused after repeated errors — re-review / disable-enable to reset")
        row.last_error = stats["errors"][-1]
        return stats

    crawler = PoliteCrawler(
        CrawlerConfig(
            enabled=True,
            source_name=row.source_id,
            base_url=row.base_url,
            user_agent=USER_AGENT,
            max_concurrency=1,
            min_delay_seconds=8.0,
            respect_robots=True,
            max_consecutive_errors=MAX_CONSECUTIVE_ERRORS_BEFORE_PAUSE,
        )
    )
    crawl = await crawler.run_sample(seed_urls=[row.base_url])

    if crawl.rate_limited:
        row.consecutive_errors = (row.consecutive_errors or 0) + 1
        row.last_error = "HTTP 429 / rate limited — auto-paused for this source"
        row.automated_enabled = False
        row.collection_method = "csv"
        stats["errors"].append(row.last_error)
        stats["note"] = "Collection paused due to rate limiting"
        return stats

    if crawl.errors:
        row.consecutive_errors = (row.consecutive_errors or 0) + 1
        row.last_error = "; ".join(crawl.errors[:5])
        stats["errors"].extend(crawl.errors[:10])
        if row.consecutive_errors >= MAX_CONSECUTIVE_ERRORS_BEFORE_PAUSE:
            row.automated_enabled = False
            row.collection_method = "csv"
            stats["errors"].append("Auto-disabled after repeated errors")
        return stats

    row.last_crawl_at = datetime.now(timezone.utc)

    if not row.listing_adapter_ready:
        # Honest path: connectivity/robots OK, no fabricated listings.
        row.consecutive_errors = 0
        row.last_error = None
        stats["note"] = (
            "Robots-respecting connectivity check completed. "
            "No listing HTML adapter is approved for this source yet — "
            "import structured observations via CSV. Disappeared listings are never assumed rented."
        )
        stats["found"] = 0
        return stats

    # Future: approved adapters return structured dicts only (no HTML/images/contacts stored).
    rows = [
        {
            **item,
            "source": row.source_id,
            "observation_status": "active_observed",
        }
        for item in crawl.listings
        if item.get("asking_price") and item.get("currency")
    ]
    ingest = await ingest_observation_rows(db, rows, default_source=row.source_id)
    stats["found"] = ingest["found"]
    stats["new"] = ingest["imported"]
    stats["updated"] = ingest.get("updated", 0)
    stats["duplicates"] = ingest["skipped"]
    stats["errors"].extend(ingest.get("errors") or [])
    row.consecutive_errors = 0
    row.last_error = None
    row.last_crawl_at = datetime.now(timezone.utc)
    return stats


async def execute_collection_run(db: AsyncSession, run_id: UUID) -> dict[str, Any]:
    run = await get_run(db, run_id)
    if not run:
        return {"error": "run not found"}
    if run.status not in {CollectionRunStatus.QUEUED.value, CollectionRunStatus.RUNNING.value}:
        return serialize_run(run)

    run.status = CollectionRunStatus.RUNNING.value
    run.started_at = datetime.now(timezone.utc)
    run.progress = {"phase": "starting"}
    await db.flush()

    source_ids = list(run.source_ids or [])
    all_errors: list[str] = []
    per_source: list[dict[str, Any]] = []

    try:
        for sid in source_ids:
            run.current_source_id = sid
            run.progress = {"phase": "collecting", "source_id": sid}
            await db.flush()

            row = await get_source_row(db, sid)
            if not row:
                all_errors.append(f"{sid}: unknown source")
                continue
            if not row.automated_enabled:
                all_errors.append(f"{sid}: skipped (not enabled)")
                per_source.append({"source_id": sid, "skipped": True, "reason": "not_enabled"})
                continue

            stats = await collect_one_source(db, row, run)
            per_source.append(stats)
            run.observations_found += int(stats.get("found") or 0)
            run.observations_new += int(stats.get("new") or 0)
            run.observations_updated += int(stats.get("updated") or 0)
            run.duplicates += int(stats.get("duplicates") or 0)
            for e in stats.get("errors") or []:
                all_errors.append(f"{sid}: {e}")

        run.progress = {"phase": "refreshing_research", "sources": per_source}
        await db.flush()
        refresh = await _post_ingest_refresh(db)

        from app.services.market_sources import refresh_observation_counts

        await refresh_observation_counts(db)

        run.status = CollectionRunStatus.COMPLETED.value
        run.progress = {
            "phase": "completed",
            "sources": per_source,
            "research": refresh,
        }
        run.errors = all_errors[:100]
        run.completed_at = datetime.now(timezone.utc)
        run.current_source_id = None
        await db.commit()
        return serialize_run(run)
    except Exception as exc:  # noqa: BLE001
        logger.exception("collection run failed")
        run.status = CollectionRunStatus.FAILED.value
        run.errors = (run.errors or []) + [str(exc)]
        run.completed_at = datetime.now(timezone.utc)
        run.progress = {"phase": "failed", "sources": per_source}
        await db.commit()
        return serialize_run(run)


async def enqueue_collection(
    db: AsyncSession,
    *,
    source_ids: list[str] | None,
    mode: str,
) -> dict[str, Any]:
    """Create a run and enqueue background work. Never crawls inline."""
    from app.services.market_sources import ensure_source_rows

    await ensure_source_rows(db)

    if mode == "all_enabled":
        result = await db.execute(
            select(ExternalMarketSource).where(ExternalMarketSource.automated_enabled.is_(True))
        )
        ids = [r.source_id for r in result.scalars().all() if r.base_url]
        if not ids:
            raise ValueError("No enabled automated sources")
    else:
        ids = [s for s in (source_ids or []) if s]
        if not ids:
            raise ValueError("Select at least one source")
        # Filter to enabled only for automated runs
        enabled_ids = []
        for sid in ids:
            row = await get_source_row(db, sid)
            if not row:
                raise ValueError(f"Unknown source: {sid}")
            if not row.automated_enabled:
                raise ValueError(f"{sid} is not enabled for automated collection (CSV only)")
            enabled_ids.append(sid)
        ids = enabled_ids

    run = await create_collection_run(db, source_ids=ids, mode=mode)
    await db.commit()
    await db.refresh(run)

    queued_via = "inline_worker"
    try:
        from app.workers.celery_app import run_external_collection_task

        run_external_collection_task.delay(str(run.id))
        queued_via = "celery"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Celery enqueue failed (%s); starting async worker", exc)
        import asyncio

        asyncio.create_task(_run_in_background(str(run.id)))

    return {"queued": True, "via": queued_via, "run": serialize_run(run)}


async def _run_in_background(run_id: str) -> None:
    from app.database.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        await execute_collection_run(db, UUID(run_id))


async def mark_csv_import(
    db: AsyncSession,
    *,
    source_id: str | None,
    import_stats: dict[str, Any],
) -> dict[str, Any]:
    """After CSV import: update source timestamps and refresh research."""
    if source_id:
        row = await get_source_row(db, source_id)
        if row:
            row.last_import_at = datetime.now(timezone.utc)
            row.last_error = None
            row.consecutive_errors = 0
    refresh = await _post_ingest_refresh(db)
    from app.services.market_sources import refresh_observation_counts

    await refresh_observation_counts(db)
    return {"import": import_stats, "research": refresh}
