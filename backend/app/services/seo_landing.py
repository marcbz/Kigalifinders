"""SEO landing eligibility, index/sitemap control, and admin recalculation."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AutomaticEligibility,
    SearchIndexStatus,
    SearchIntent,
    SeoControl,
    SitemapStatus,
)
from app.services.intent_config import IntentAutomationConfig
from app.services.intent_copy import normalize_query
from app.services.seo_attributes import count_seo_dimensions, query_has_blocked_seo_attributes


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SeoValidationError(ValueError):
    """Invalid index/sitemap combination."""


def enforce_sitemap_rules(index_status: str, sitemap_status: str) -> None:
    if index_status != SearchIndexStatus.INDEXABLE.value and sitemap_status == SitemapStatus.INCLUDED.value:
        raise SeoValidationError(
            "Noindex or non-indexable pages cannot be included in the XML sitemap. "
            "Set index status to Indexable first, or exclude from sitemap."
        )


def sync_sitemap_with_index(intent: SearchIntent) -> None:
    """Keep sitemap consistent when index becomes non-indexable."""
    if intent.index_status != SearchIndexStatus.INDEXABLE.value:
        intent.sitemap_status = SitemapStatus.EXCLUDED.value


def is_manual_override(intent: SearchIntent) -> bool:
    return intent.seo_control == SeoControl.MANUAL.value or bool(intent.locked_by_admin)


def build_eligibility_checks(intent: SearchIntent, cfg: IntentAutomationConfig) -> dict[str, Any]:
    q = normalize_query(intent.query or {})
    dims = count_seo_dimensions(q)
    blocked = query_has_blocked_seo_attributes(intent.query or {})
    checks: list[dict[str, Any]] = []

    if blocked:
        checks.append(
            {
                "label": "Allowed SEO attributes only",
                "passed": False,
                "detail": f"Disallowed: {', '.join(blocked)}",
            }
        )
    else:
        checks.append({"label": "Allowed SEO attributes only", "passed": True, "detail": "No blocked attributes"})

    checks.append(
        {
            "label": f"Minimum dimensions ({cfg.min_dimensions_for_index})",
            "passed": dims >= cfg.min_dimensions_for_index,
            "detail": f"{dims} dimension(s)",
        }
    )
    checks.append(
        {
            "label": f"Minimum matching properties ({cfg.min_verified_for_index})",
            "passed": intent.match_count >= cfg.min_verified_for_index,
            "detail": f"{intent.match_count} matching propert{'y' if intent.match_count == 1 else 'ies'}",
        }
    )
    checks.append(
        {
            "label": f"Minimum quality score ({cfg.min_quality_for_index})",
            "passed": intent.quality_score >= cfg.min_quality_for_index,
            "detail": f"Quality {intent.quality_score:.0f}",
        }
    )
    checks.append(
        {
            "label": f"Minimum opportunity score ({cfg.min_opportunity_for_index})",
            "passed": intent.opportunity_score >= cfg.min_opportunity_for_index,
            "detail": f"Opportunity {intent.opportunity_score:.0f}",
        }
    )
    checks.append(
        {
            "label": f"Minimum observations ({cfg.min_observations_for_research_value})",
            "passed": intent.matching_observation_count >= cfg.min_observations_for_research_value
            or intent.match_count >= cfg.min_verified_for_index,
            "detail": f"{intent.matching_observation_count} observation(s)",
        }
    )

    unique_ok = True
    if cfg.require_unique_content:
        intro = (intent.intro_html or "").strip()
        meta = (intent.meta_description or "").strip()
        has_text = len(intro) >= cfg.min_unique_content_chars or len(meta) >= cfg.min_unique_content_chars
        has_market = bool(intent.matching_observation_count and intent.matching_observation_count >= 3)
        unique_ok = has_text or has_market or bool(intent.title and intent.h1 and meta)
        checks.append(
            {
                "label": "Unique content or market data",
                "passed": unique_ok,
                "detail": "Has intro/meta or observation-backed data" if unique_ok else "Needs more unique copy",
            }
        )

    checks.append(
        {
            "label": "Automatic SEO landing generation enabled",
            "passed": cfg.allow_auto_index,
            "detail": "Enabled" if cfg.allow_auto_index else "Disabled in SEO settings",
        }
    )
    checks.append(
        {
            "label": "Page enabled",
            "passed": bool(intent.is_enabled) and intent.index_status != SearchIndexStatus.DISABLED.value,
            "detail": "Enabled" if intent.is_enabled else "Disabled",
        }
    )

    eligible = all(c["passed"] for c in checks if c["label"] != "Automatic SEO landing generation enabled") and (
        cfg.allow_auto_index or is_manual_override(intent)
    )
    if not cfg.allow_auto_index and not is_manual_override(intent):
        eligible = False

    failed = [c for c in checks if not c["passed"]]
    return {
        "eligible": eligible,
        "checks": checks,
        "dimensions": dims,
        "failed_count": len(failed),
        "summary": "Eligible for SEO indexing" if eligible else f"Excluded — {failed[0]['detail'] if failed else 'rules not met'}",
    }


def evaluate_automatic_eligibility(intent: SearchIntent, cfg: IntentAutomationConfig) -> str:
    if not intent.is_enabled or intent.index_status == SearchIndexStatus.DISABLED.value:
        return AutomaticEligibility.EXCLUDED.value
    details = build_eligibility_checks(intent, cfg)
    return AutomaticEligibility.ELIGIBLE.value if details["eligible"] else AutomaticEligibility.EXCLUDED.value


def apply_automatic_statuses(intent: SearchIntent, cfg: IntentAutomationConfig) -> None:
    """Apply automatic index + sitemap from eligibility. Skipped when manual override."""
    if is_manual_override(intent):
        return
    if not intent.is_enabled or intent.index_status == SearchIndexStatus.DISABLED.value:
        intent.automatic_eligibility = AutomaticEligibility.EXCLUDED.value
        return

    intent.automatic_eligibility = evaluate_automatic_eligibility(intent, cfg)
    intent.last_evaluated_at = _now()

    if not cfg.allow_auto_index:
        if intent.index_status not in {SearchIndexStatus.DISABLED.value}:
            intent.index_status = SearchIndexStatus.NOINDEX.value
            intent.status_reason = "Automatic SEO landing generation disabled in settings"
        intent.sitemap_status = SitemapStatus.EXCLUDED.value
        return

    if intent.automatic_eligibility == AutomaticEligibility.ELIGIBLE.value:
        intent.index_status = SearchIndexStatus.INDEXABLE.value
        intent.status_reason = (
            f"Auto-indexable: {build_eligibility_checks(intent, cfg)['dimensions']} dimensions, "
            f"{intent.match_count} matching properties"
        )
        if cfg.allow_sitemap_inclusion:
            intent.sitemap_status = SitemapStatus.INCLUDED.value
        else:
            intent.sitemap_status = SitemapStatus.EXCLUDED.value
    else:
        details = build_eligibility_checks(intent, cfg)
        failed = [c for c in details["checks"] if not c["passed"]]
        reason = failed[0]["detail"] if failed else "Does not meet SEO thresholds"
        if intent.index_status == SearchIndexStatus.INDEXABLE.value:
            intent.index_status = SearchIndexStatus.NOINDEX.value
        elif intent.index_status not in {
            SearchIndexStatus.DISCOVERED.value,
            SearchIndexStatus.DRAFT.value,
            SearchIndexStatus.NOINDEX.value,
        }:
            intent.index_status = SearchIndexStatus.NOINDEX.value
        intent.status_reason = f"Excluded: {reason}"
        intent.sitemap_status = SitemapStatus.EXCLUDED.value

    enforce_sitemap_rules(intent.index_status, intent.sitemap_status)


def set_index_status_manual(intent: SearchIntent, status: str) -> None:
    if status not in {SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.NOINDEX.value}:
        raise SeoValidationError("Index status must be indexable or noindex")
    intent.index_status = status
    intent.seo_control = SeoControl.MANUAL.value
    intent.locked_by_admin = True
    intent.status_reason = f"Manually set to {status}"
    if status == SearchIndexStatus.NOINDEX.value:
        intent.sitemap_status = SitemapStatus.EXCLUDED.value
    intent.last_evaluated_at = _now()
    enforce_sitemap_rules(intent.index_status, intent.sitemap_status)


def set_sitemap_status_manual(intent: SearchIntent, status: str) -> None:
    if status not in {SitemapStatus.INCLUDED.value, SitemapStatus.EXCLUDED.value}:
        raise SeoValidationError("Sitemap status must be included or excluded")
    if status == SitemapStatus.INCLUDED.value and intent.index_status != SearchIndexStatus.INDEXABLE.value:
        raise SeoValidationError(
            "Only indexable pages can be included in the sitemap. Set index status to Indexable first."
        )
    intent.sitemap_status = status
    intent.seo_control = SeoControl.MANUAL.value
    intent.locked_by_admin = True
    intent.status_reason = f"Manually sitemap {status}"
    intent.last_evaluated_at = _now()
    enforce_sitemap_rules(intent.index_status, intent.sitemap_status)


def reset_to_automatic(intent: SearchIntent) -> None:
    intent.seo_control = SeoControl.AUTOMATIC.value
    intent.locked_by_admin = False
    intent.status_reason = "Reset to automatic SEO rules"
    intent.last_evaluated_at = _now()


async def landing_page_stats(db: AsyncSession) -> dict[str, int]:
    result = await db.execute(select(SearchIntent))
    intents = list(result.scalars().all())
    stats = {
        "total": len(intents),
        "eligible": 0,
        "excluded": 0,
        "indexable": 0,
        "noindex": 0,
        "sitemap_included": 0,
        "sitemap_excluded": 0,
        "manual": 0,
        "automatic": 0,
    }
    for i in intents:
        if i.automatic_eligibility == AutomaticEligibility.ELIGIBLE.value:
            stats["eligible"] += 1
        else:
            stats["excluded"] += 1
        if i.index_status == SearchIndexStatus.INDEXABLE.value:
            stats["indexable"] += 1
        elif i.index_status == SearchIndexStatus.NOINDEX.value:
            stats["noindex"] += 1
        if i.sitemap_status == SitemapStatus.INCLUDED.value:
            stats["sitemap_included"] += 1
        else:
            stats["sitemap_excluded"] += 1
        if i.seo_control == SeoControl.MANUAL.value:
            stats["manual"] += 1
        else:
            stats["automatic"] += 1
    return stats


async def recalculate_all_landings(db: AsyncSession, cfg: IntentAutomationConfig) -> dict[str, Any]:
    from app.services.intent_automation import apply_index_rules, recalculate_all_intent_metrics

    before = await landing_page_stats(db)
    await recalculate_all_intent_metrics(db)
    await apply_index_rules(db, cfg)

    result = await db.execute(select(SearchIntent))
    for intent in result.scalars().all():
        if is_manual_override(intent):
            intent.automatic_eligibility = evaluate_automatic_eligibility(intent, cfg)
            intent.last_evaluated_at = _now()
            sync_sitemap_with_index(intent)

    await db.flush()
    after = await landing_page_stats(db)
    return {"before": before, "after": after}


SORT_COLUMNS = {
    "match_count": SearchIntent.match_count,
    "matching_observation_count": SearchIntent.matching_observation_count,
    "opportunity_score": SearchIntent.opportunity_score,
    "quality_score": SearchIntent.quality_score,
    "index_status": SearchIntent.index_status,
    "sitemap_status": SearchIntent.sitemap_status,
    "automatic_eligibility": SearchIntent.automatic_eligibility,
    "updated_at": SearchIntent.updated_at,
    "last_evaluated_at": SearchIntent.last_evaluated_at,
    "location_slug": SearchIntent.location_slug,
}


async def list_search_intents_admin(
    db: AsyncSession,
    *,
    search: str | None = None,
    location: str | None = None,
    property_type: str | None = None,
    index_status: str | None = None,
    sitemap_status: str | None = None,
    automatic_eligibility: str | None = None,
    seo_control: str | None = None,
    sort_by: str = "updated_at",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    q = select(SearchIntent)
    count_q = select(func.count()).select_from(SearchIntent)

    if search:
        term = f"%{search.strip().lower()}%"
        filt = or_(
            SearchIntent.path.ilike(term),
            SearchIntent.title.ilike(term),
            SearchIntent.h1.ilike(term),
            SearchIntent.intent_slug.ilike(term),
        )
        q = q.where(filt)
        count_q = count_q.where(filt)
    if location:
        q = q.where(SearchIntent.location_slug == location.lower())
        count_q = count_q.where(SearchIntent.location_slug == location.lower())
    if property_type:
        q = q.where(SearchIntent.query["property_type"].astext == property_type.lower())
        count_q = count_q.where(SearchIntent.query["property_type"].astext == property_type.lower())
    if index_status:
        q = q.where(SearchIntent.index_status == index_status)
        count_q = count_q.where(SearchIntent.index_status == index_status)
    if sitemap_status:
        q = q.where(SearchIntent.sitemap_status == sitemap_status)
        count_q = count_q.where(SearchIntent.sitemap_status == sitemap_status)
    if automatic_eligibility:
        q = q.where(SearchIntent.automatic_eligibility == automatic_eligibility)
        count_q = count_q.where(SearchIntent.automatic_eligibility == automatic_eligibility)
    if seo_control:
        q = q.where(SearchIntent.seo_control == seo_control)
        count_q = count_q.where(SearchIntent.seo_control == seo_control)

    col = SORT_COLUMNS.get(sort_by, SearchIntent.updated_at)
    q = q.order_by(col.desc() if sort_dir.lower() == "desc" else col.asc())
    total = int((await db.execute(count_q)).scalar() or 0)
    rows = list((await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all())
    return {"total": total, "page": page, "page_size": page_size, "items": rows}
