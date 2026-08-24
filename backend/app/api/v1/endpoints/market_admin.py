"""Admin: search intents, observations import, research rebuild, GSC suggestions."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin, require_staff
from app.database.session import get_db
from app.models import GscQuerySuggestion, SearchIndexStatus, SearchIntent, User
from app.schemas.market import (
    GscSuggestionCreate,
    GscSuggestionItem,
    ObservationImportResult,
    SearchIntentCreate,
    SearchIntentListItem,
    SearchIntentUpdate,
)
from app.services.crawler import CrawlerConfig, PoliteCrawler
from app.services.market_sources import list_sources
from app.services.observations import (
    bulk_update_observations,
    import_observations_csv,
    list_observations,
)
from app.services.search_intent import build_path, rebuild_intent_metrics


class BulkIdsPayload(BaseModel):
    ids: List[str] = Field(default_factory=list)
    action: str


class BulkIntentPayload(BaseModel):
    ids: List[UUID] = Field(default_factory=list)
    action: str


router = APIRouter(prefix="/admin/market", tags=["Admin Market Intelligence"])


@router.get("/search-intents", response_model=list[SearchIntentListItem])
async def list_search_intents(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    result = await db.execute(select(SearchIntent).order_by(SearchIntent.updated_at.desc()))
    return list(result.scalars().all())


@router.post("/search-intents", response_model=SearchIntentListItem)
async def create_search_intent(
    payload: SearchIntentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    path = build_path(payload.location_slug, payload.intent_slug)
    existing = await db.execute(select(SearchIntent).where(SearchIntent.path == path))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Intent path already exists")
    intent = SearchIntent(
        location_slug=payload.location_slug.lower(),
        intent_slug=payload.intent_slug.lower(),
        path=path,
        query=payload.query,
        title=payload.title,
        h1=payload.h1,
        meta_description=payload.meta_description,
        intro_html=payload.intro_html,
        index_status=payload.index_status,
        is_enabled=payload.is_enabled,
    )
    db.add(intent)
    await db.flush()
    await rebuild_intent_metrics(db, intent)
    await db.commit()
    await db.refresh(intent)
    return intent


@router.patch("/search-intents/{intent_id}", response_model=SearchIntentListItem)
async def update_search_intent(
    intent_id: UUID,
    payload: SearchIntentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(intent, k, v)
    await rebuild_intent_metrics(db, intent)
    await db.commit()
    await db.refresh(intent)
    return intent


@router.post("/search-intents/{intent_id}/regenerate", response_model=SearchIntentListItem)
async def regenerate_intent(
    intent_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    await rebuild_intent_metrics(db, intent)
    await db.commit()
    await db.refresh(intent)
    return intent


@router.post("/search-intents/{intent_id}/approve", response_model=SearchIntentListItem)
async def approve_intent(
    intent_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    await rebuild_intent_metrics(db, intent)
    if intent.match_count < 1 or intent.quality_score < 40:
        intent.index_status = SearchIndexStatus.NOINDEX.value
        intent.status_reason = "Manual review: not enough quality to index"
    else:
        intent.index_status = SearchIndexStatus.INDEXABLE.value
        intent.status_reason = "Manually approved"
        intent.locked_by_admin = True
    await db.commit()
    await db.refresh(intent)
    return intent


@router.post("/search-intents/{intent_id}/noindex", response_model=SearchIntentListItem)
async def noindex_intent(
    intent_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    intent.index_status = SearchIndexStatus.NOINDEX.value
    intent.locked_by_admin = True
    intent.status_reason = "Manually set to noindex"
    await db.commit()
    await db.refresh(intent)
    return intent


@router.delete("/search-intents/{intent_id}")
async def disable_intent(
    intent_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    intent.is_enabled = False
    intent.index_status = SearchIndexStatus.DISABLED.value
    await db.commit()
    return {"ok": True}


@router.post("/observations/import-csv", response_model=ObservationImportResult)
async def import_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    raw = await file.read()
    result = await import_observations_csv(db, raw)
    from app.services.research import rebuild_observation_snapshots
    from app.services.intent_automation import apply_index_rules, recalculate_all_intent_metrics
    from app.services.intent_config import load_automation_config

    await rebuild_observation_snapshots(db)
    await recalculate_all_intent_metrics(db)
    await apply_index_rules(db, await load_automation_config(db))
    await db.commit()
    return ObservationImportResult(**result)


@router.post("/research/rebuild")
async def rebuild_research(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Full research refresh + intent discovery/metrics (safe to run on a schedule)."""
    from app.services.intent_automation import run_daily_automation

    return await run_daily_automation(db)


@router.post("/automation/daily")
async def automation_daily(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.intent_automation import run_daily_automation

    return await run_daily_automation(db)


@router.post("/automation/weekly")
async def automation_weekly(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.intent_automation import run_weekly_audit

    return await run_weekly_audit(db)


@router.post("/automation/discover")
async def automation_discover(
    deep: bool = False,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.intent_automation import discover_intents

    result = await discover_intents(db, deep=deep)
    await db.commit()
    return result


@router.post("/search-intents/{intent_id}/lock")
async def lock_intent(
    intent_id: UUID,
    locked: bool = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    intent.locked_by_admin = locked
    intent.status_reason = "Locked by admin" if locked else "Unlocked by admin"
    await db.commit()
    return {"ok": True, "locked_by_admin": intent.locked_by_admin}


@router.post("/search-intents/{intent_id}/disable-automation")
async def disable_automation(
    intent_id: UUID,
    disabled: bool = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    intent.automation_disabled = disabled
    intent.status_reason = "Automation disabled" if disabled else "Automation re-enabled"
    await db.commit()
    return {"ok": True, "automation_disabled": intent.automation_disabled}


@router.post("/crawler/sample")
async def crawler_sample(
    _: User = Depends(require_admin),
):
    crawler = PoliteCrawler(CrawlerConfig(enabled=False))
    result = await crawler.run_sample()
    return {
        "fetched": result.fetched,
        "skipped_robots": result.skipped_robots,
        "rate_limited": result.rate_limited,
        "errors": result.errors,
        "listings": result.listings,
        "note": "Crawler starts disabled. Prefer CSV import until one source is approved.",
        "sources": list_sources(),
    }


@router.get("/market-sources")
async def market_sources(_: User = Depends(require_staff)):
    return {
        "sources": list_sources(),
        "policy": (
            "Automated crawls remain disabled by default. Use CSV import. "
            "Never bypass CAPTCHA, login, paywalls, or anti-bot systems. "
            "Disappeared listings → not_found/unknown — never assumed rented."
        ),
    }


@router.get("/observations")
async def admin_list_observations(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    source: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    return await list_observations(db, page=page, page_size=page_size, source=source, status=status)


@router.post("/observations/bulk")
async def admin_bulk_observations(
    payload: BulkIdsPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    allowed = {"mark_invalid", "mark_not_found", "mark_active", "mark_unknown", "reprocess"}
    if payload.action not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported action. Allowed: {sorted(allowed)}")
    if payload.action == "reprocess":
        from app.services.intent_automation import run_daily_automation

        # Reprocess = rebuild research + discovery without changing observation statuses
        auto = await run_daily_automation(db)
        return {"updated": 0, "action": "reprocess", "automation": auto}
    result = await bulk_update_observations(db, payload.ids, action=payload.action)
    await db.commit()
    return result


@router.post("/search-intents/bulk")
async def admin_bulk_intents(
    payload: BulkIntentPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if payload.action == "rebuild_research":
        from app.services.intent_automation import run_daily_automation

        auto = await run_daily_automation(db)
        return {"updated": 0, "automation": auto}
    if not payload.ids:
        return {"updated": 0}
    result = await db.execute(select(SearchIntent).where(SearchIntent.id.in_(payload.ids)))
    intents = list(result.scalars().all())
    updated = 0
    for intent in intents:
        if payload.action in {"approve", "indexable"}:
            await rebuild_intent_metrics(db, intent)
            if intent.match_count >= 1 and intent.quality_score >= 40:
                intent.index_status = SearchIndexStatus.INDEXABLE.value
                intent.status_reason = "Bulk: approved/indexable"
                intent.locked_by_admin = True
            else:
                intent.index_status = SearchIndexStatus.NOINDEX.value
                intent.status_reason = "Bulk: not enough quality"
                intent.locked_by_admin = True
            updated += 1
        elif payload.action == "noindex":
            intent.index_status = SearchIndexStatus.NOINDEX.value
            intent.locked_by_admin = True
            intent.status_reason = "Bulk: noindex"
            updated += 1
        elif payload.action == "enable":
            intent.is_enabled = True
            if intent.index_status == SearchIndexStatus.DISABLED.value:
                intent.index_status = SearchIndexStatus.DRAFT.value
            updated += 1
        elif payload.action == "disable":
            intent.is_enabled = False
            intent.index_status = SearchIndexStatus.DISABLED.value
            intent.locked_by_admin = True
            intent.status_reason = "Bulk: disabled"
            updated += 1
        elif payload.action == "refresh":
            await rebuild_intent_metrics(db, intent)
            updated += 1
        else:
            raise HTTPException(status_code=400, detail="Unsupported bulk action")
    await db.commit()
    return {"updated": updated, "action": payload.action}


@router.get("/gsc-suggestions", response_model=list[GscSuggestionItem])
async def list_gsc_suggestions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    result = await db.execute(select(GscQuerySuggestion).order_by(GscQuerySuggestion.created_at.desc()).limit(200))
    return list(result.scalars().all())


@router.post("/gsc-suggestions", response_model=GscSuggestionItem)
async def create_gsc_suggestion(
    payload: GscSuggestionCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    row = GscQuerySuggestion(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/gsc-suggestions/{suggestion_id}")
async def update_gsc_suggestion(
    suggestion_id: UUID,
    status: Optional[str] = None,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    row = await db.get(GscQuerySuggestion, suggestion_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if status:
        row.status = status
    if notes is not None:
        row.notes = notes
    await db.commit()
    return {"ok": True, "id": str(row.id), "status": row.status}
