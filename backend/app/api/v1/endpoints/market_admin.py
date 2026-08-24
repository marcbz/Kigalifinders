"""Admin: search intents, observations import, research rebuild, GSC suggestions."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
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
from app.services.observations import import_observations_csv
from app.services.research import rebuild_observation_snapshots, rebuild_verified_snapshots
from app.services.search_intent import build_path, rebuild_intent_metrics

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
    else:
        intent.index_status = SearchIndexStatus.INDEXABLE.value
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
    await db.commit()
    return ObservationImportResult(**result)


@router.post("/research/rebuild")
async def rebuild_research(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    v = await rebuild_verified_snapshots(db)
    o = await rebuild_observation_snapshots(db)
    # refresh all intents
    intents = list(
        (
            await db.execute(select(SearchIntent).where(SearchIntent.is_enabled == True))  # noqa: E712
        ).scalars().all()
    )
    for intent in intents:
        await rebuild_intent_metrics(db, intent)
    await db.commit()
    return {"verified_snapshots": v, "observation_snapshots": o, "intents_refreshed": len(intents)}


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
    }


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
