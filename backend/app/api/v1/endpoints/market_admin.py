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
from app.models import GscQuerySuggestion, SearchIndexStatus, SearchIntent, SitemapStatus, User
from app.schemas.market import (
    GscSuggestionCreate,
    GscSuggestionItem,
    SearchIntentCreate,
    SearchIntentEligibilityDetails,
    SearchIntentListItem,
    SearchIntentListResponse,
    SearchIntentUpdate,
)
from app.services.market_sources import list_source_dashboard, touch_source_import
from app.services.observations import (
    CSV_TEMPLATE,
    bulk_update_observations,
    import_observations_csv,
    list_observations,
    refresh_research_after_import,
)
from app.services.intent_config import (
    DEFAULT_CONFIG,
    load_automation_config,
    save_automation_config,
    seo_settings_public,
)
from app.services.search_intent import build_path, rebuild_intent_metrics


class BulkIdsPayload(BaseModel):
    ids: List[str] = Field(default_factory=list)
    action: str


class BulkIntentPayload(BaseModel):
    ids: List[UUID] = Field(default_factory=list)
    action: str


class SeoSettingsUpdate(BaseModel):
    min_dimensions_for_index: Optional[int] = None
    min_verified_for_index: Optional[int] = None
    min_quality_for_index: Optional[float] = None
    max_sitemap_urls: Optional[int] = None
    allow_auto_index: Optional[bool] = None
    allow_sitemap_inclusion: Optional[bool] = None


class IndexStatusPayload(BaseModel):
    status: str = Field(..., description="indexable or noindex")


class SitemapStatusPayload(BaseModel):
    status: str = Field(..., description="included or excluded")


class MarketSourceCreate(BaseModel):
    name: str
    source_id: Optional[str] = None
    base_url: Optional[str] = None
    policy_notes: Optional[str] = None


class MarketSourceUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    policy_notes: Optional[str] = None
    enabled: Optional[bool] = None
    archived: Optional[bool] = None


router = APIRouter(prefix="/admin/market", tags=["Admin Market Intelligence"])


@router.get("/search-intents", response_model=SearchIntentListResponse)
async def list_search_intents(
    search: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    property_type: Optional[str] = Query(None),
    index_status: Optional[str] = Query(None),
    sitemap_status: Optional[str] = Query(None),
    automatic_eligibility: Optional[str] = Query(None),
    seo_control: Optional[str] = Query(None),
    simple_status: Optional[str] = Query(None),
    attribute: Optional[str] = Query(None),
    sort_by: str = Query("updated_at"),
    sort_dir: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    from app.services.seo_landing import enrich_intent_admin_row, list_search_intents_admin

    data = await list_search_intents_admin(
        db,
        search=search,
        location=location,
        property_type=property_type,
        index_status=index_status,
        sitemap_status=sitemap_status,
        automatic_eligibility=automatic_eligibility,
        seo_control=seo_control,
        simple_status=simple_status,
        attribute=attribute,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    items = []
    for intent in data["items"]:
        base = SearchIntentListItem.model_validate(intent).model_dump()
        base.update(enrich_intent_admin_row(intent))
        items.append(base)
    return {
        "total": data["total"],
        "page": data["page"],
        "page_size": data["page_size"],
        "items": items,
    }


@router.get("/search-intents/locations")
async def list_search_intent_locations(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    from sqlalchemy import distinct

    result = await db.execute(
        select(distinct(SearchIntent.location_slug)).order_by(SearchIntent.location_slug)
    )
    return [row[0] for row in result.all()]


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
    from app.services.seo_landing import SeoValidationError, set_index_status_manual

    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    await rebuild_intent_metrics(db, intent)
    try:
        set_index_status_manual(intent, SearchIndexStatus.INDEXABLE.value)
    except SeoValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    await db.refresh(intent)
    return intent


@router.post("/search-intents/{intent_id}/set-index", response_model=SearchIntentListItem)
async def set_intent_index_status(
    intent_id: UUID,
    payload: IndexStatusPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.seo_landing import SeoValidationError, set_index_status_manual

    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    status = payload.status.lower()
    if status not in {SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.NOINDEX.value}:
        raise HTTPException(status_code=400, detail="Status must be indexable or noindex")
    try:
        set_index_status_manual(intent, status)
    except SeoValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    await db.refresh(intent)
    return intent


@router.post("/search-intents/{intent_id}/set-sitemap", response_model=SearchIntentListItem)
async def set_intent_sitemap_status(
    intent_id: UUID,
    payload: SitemapStatusPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.seo_landing import SeoValidationError, set_sitemap_status_manual

    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    status = payload.status.lower()
    if status not in {SitemapStatus.INCLUDED.value, SitemapStatus.EXCLUDED.value}:
        raise HTTPException(status_code=400, detail="Status must be included or excluded")
    try:
        set_sitemap_status_manual(intent, status)
    except SeoValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    await db.refresh(intent)
    return intent


@router.post("/search-intents/{intent_id}/reset-automatic", response_model=SearchIntentListItem)
async def reset_intent_automatic(
    intent_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.intent_config import load_automation_config
    from app.services.seo_landing import apply_automatic_statuses, evaluate_automatic_eligibility, reset_to_automatic

    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    await rebuild_intent_metrics(db, intent)
    reset_to_automatic(intent)
    cfg = await load_automation_config(db)
    intent.automatic_eligibility = evaluate_automatic_eligibility(intent, cfg)
    apply_automatic_statuses(intent, cfg)
    await db.commit()
    await db.refresh(intent)
    return intent


@router.get("/search-intents/{intent_id}/eligibility", response_model=SearchIntentEligibilityDetails)
async def get_intent_eligibility(
    intent_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    from app.services.intent_config import load_automation_config
    from app.services.seo_landing import build_eligibility_checks

    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    cfg = await load_automation_config(db)
    details = build_eligibility_checks(intent, cfg)
    return {
        **details,
        "index_status": intent.index_status,
        "sitemap_status": intent.sitemap_status,
        "seo_control": intent.seo_control,
        "automatic_eligibility": intent.automatic_eligibility,
        "status_reason": intent.status_reason,
        "last_evaluated_at": intent.last_evaluated_at,
    }


@router.get("/seo-settings")
async def get_seo_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    cfg = await load_automation_config(db)
    from app.services.intent_automation import seo_eligibility_summary

    summary = await seo_eligibility_summary(db)
    return {**seo_settings_public(cfg), "summary": summary}


@router.get("/seo-attributes")
async def get_seo_attributes(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    from app.services.seo_attributes import seo_attribute_admin_stats

    return await seo_attribute_admin_stats(db)


@router.put("/seo-settings")
async def update_seo_settings(
    payload: SeoSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.intent_automation import seo_eligibility_summary
    from app.services.seo_landing import recalculate_all_landings

    cfg = await load_automation_config(db)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(cfg, k, v)
    cfg = await save_automation_config(db, cfg)
    recalc = await recalculate_all_landings(db, cfg)
    summary = await seo_eligibility_summary(db)
    await db.commit()
    return {
        **seo_settings_public(cfg),
        "recalculation": recalc,
        "summary": summary,
    }


@router.post("/seo-settings/reset")
async def reset_seo_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.intent_automation import seo_eligibility_summary
    from app.services.seo_landing import recalculate_all_landings

    cfg = await save_automation_config(db, DEFAULT_CONFIG)
    recalc = await recalculate_all_landings(db, cfg)
    summary = await seo_eligibility_summary(db)
    await db.commit()
    return {
        **seo_settings_public(cfg),
        "recalculation": recalc,
        "summary": summary,
    }


@router.get("/seo-summary")
async def get_seo_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    from app.services.intent_automation import seo_eligibility_summary

    return await seo_eligibility_summary(db)


@router.post("/seo-settings/reevaluate")
async def reevaluate_seo(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.intent_automation import seo_eligibility_summary
    from app.services.seo_landing import recalculate_all_landings

    cfg = await load_automation_config(db)
    recalc = await recalculate_all_landings(db, cfg)
    summary = await seo_eligibility_summary(db)
    await db.commit()
    return {"recalculation": recalc, "summary": summary}


@router.post("/seo-settings/recalculate")
async def recalculate_seo_landings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Apply / recalculate landing pages with before/after stats."""
    from app.services.intent_automation import seo_eligibility_summary
    from app.services.seo_landing import recalculate_all_landings

    cfg = await load_automation_config(db)
    recalc = await recalculate_all_landings(db, cfg)
    summary = await seo_eligibility_summary(db)
    await db.commit()
    return {"recalculation": recalc, "summary": summary}


@router.post("/search-intents/{intent_id}/noindex", response_model=SearchIntentListItem)
async def noindex_intent(
    intent_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    from app.services.seo_landing import SeoValidationError, set_index_status_manual

    intent = await db.get(SearchIntent, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        set_index_status_manual(intent, SearchIndexStatus.NOINDEX.value)
    except SeoValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
    intent.sitemap_status = SitemapStatus.EXCLUDED.value
    await db.commit()
    return {"ok": True}


@router.post("/observations/import-csv")
async def import_csv(
    file: UploadFile = File(...),
    source_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    raw = await file.read()
    result = await import_observations_csv(db, raw)
    await touch_source_import(db, source_id)
    research = await refresh_research_after_import(db)
    await db.commit()
    return {
        "rows_processed": result.get("rows_processed", 0),
        "imported": result.get("imported", 0),
        "new_observations": result.get("new_observations", result.get("imported", 0)),
        "updated": result.get("updated", 0),
        "updated_observations": result.get("updated_observations", result.get("updated", 0)),
        "duplicates": result.get("duplicates", result.get("skipped", 0)),
        "invalid_rows": result.get("invalid_rows", 0),
        "errors": result.get("errors", []),
        "import_reference": result.get("import_reference"),
        "research": research,
    }


@router.get("/observations/csv-template")
async def observations_csv_template(_: User = Depends(require_staff)):
    from fastapi.responses import Response

    return Response(
        content=CSV_TEMPLATE,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="external-observations-template.csv"'},
    )


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


@router.get("/market-sources")
async def market_sources(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    data = await list_source_dashboard(db)
    await db.commit()
    return data


@router.get("/market-data/summary")
async def market_data_summary_endpoint(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    from app.services.market_sources import market_data_summary

    data = await market_data_summary(db)
    await db.commit()
    return data


@router.post("/market-sources")
async def create_market_source_endpoint(
    payload: MarketSourceCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.market_sources import create_market_source, market_data_summary

    try:
        row = await create_market_source(
            db,
            name=payload.name,
            source_id=payload.source_id,
            base_url=payload.base_url,
            policy_notes=payload.policy_notes,
        )
        summary = await market_data_summary(db)
        await db.commit()
        return {"ok": True, "source_id": row.source_id, "summary": summary}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/market-sources/{source_id}")
async def update_market_source_endpoint(
    source_id: str,
    payload: MarketSourceUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.market_sources import market_data_summary, update_market_source

    row = await update_market_source(
        db,
        source_id,
        name=payload.name,
        base_url=payload.base_url,
        policy_notes=payload.policy_notes,
        enabled=payload.enabled,
        archived=payload.archived,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Source not found")
    summary = await market_data_summary(db)
    await db.commit()
    return {"ok": True, "source_id": row.source_id, "summary": summary}


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
    allowed = {
        "mark_invalid",
        "mark_not_found",
        "mark_active",
        "mark_unknown",
        "hide",
        "delete",
        "reprocess",
    }
    if payload.action not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported action. Allowed: {sorted(allowed)}")
    if payload.action == "reprocess":
        research = await refresh_research_after_import(db)
        await db.commit()
        return {"updated": 0, "action": "reprocess", "research": research}
    result = await bulk_update_observations(db, payload.ids, action=payload.action)
    research = await refresh_research_after_import(db)
    await db.commit()
    return {**result, "research": research}


@router.post("/search-intents/bulk")
async def admin_bulk_intents(
    payload: BulkIntentPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.intent_config import load_automation_config
    from app.services.seo_landing import (
        SeoValidationError,
        apply_automatic_statuses,
        evaluate_automatic_eligibility,
        reset_to_automatic,
        set_index_status_manual,
        set_sitemap_status_manual,
    )

    if payload.action == "rebuild_research":
        from app.services.intent_automation import run_daily_automation

        auto = await run_daily_automation(db)
        return {"updated": 0, "automation": auto, "ok": True}
    if not payload.ids:
        return {"updated": 0, "ok": True}

    result = await db.execute(select(SearchIntent).where(SearchIntent.id.in_(payload.ids)))
    intents = list(result.scalars().all())
    cfg = await load_automation_config(db)
    updated = 0
    errors: list[str] = []

    for intent in intents:
        try:
            if payload.action in {"approve", "indexable", "set_indexable"}:
                await rebuild_intent_metrics(db, intent)
                set_index_status_manual(intent, SearchIndexStatus.INDEXABLE.value)
                updated += 1
            elif payload.action in {"noindex", "set_noindex"}:
                set_index_status_manual(intent, SearchIndexStatus.NOINDEX.value)
                updated += 1
            elif payload.action in {"sitemap_include", "include_sitemap"}:
                set_sitemap_status_manual(intent, SitemapStatus.INCLUDED.value)
                updated += 1
            elif payload.action in {"sitemap_exclude", "exclude_sitemap"}:
                set_sitemap_status_manual(intent, SitemapStatus.EXCLUDED.value)
                updated += 1
            elif payload.action == "reset_automatic":
                await rebuild_intent_metrics(db, intent)
                reset_to_automatic(intent)
                intent.automatic_eligibility = evaluate_automatic_eligibility(intent, cfg)
                apply_automatic_statuses(intent, cfg)
                updated += 1
            elif payload.action == "enable":
                intent.is_enabled = True
                if intent.index_status == SearchIndexStatus.DISABLED.value:
                    intent.index_status = SearchIndexStatus.DRAFT.value
                updated += 1
            elif payload.action == "disable":
                intent.is_enabled = False
                intent.index_status = SearchIndexStatus.DISABLED.value
                intent.sitemap_status = SitemapStatus.EXCLUDED.value
                intent.status_reason = "Bulk: disabled"
                updated += 1
            elif payload.action in {"refresh", "rebuild"}:
                await rebuild_intent_metrics(db, intent)
                updated += 1
            else:
                raise HTTPException(status_code=400, detail="Unsupported bulk action")
        except SeoValidationError as exc:
            errors.append(f"{intent.path}: {exc}")
        except HTTPException:
            raise

    await db.commit()
    return {"updated": updated, "action": payload.action, "ok": not errors, "errors": errors}


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
