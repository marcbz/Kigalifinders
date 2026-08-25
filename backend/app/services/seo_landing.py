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
    """Eligibility: PRIMARY = meaningful search-filter count, then quality.

    Matching properties are an optional secondary safety check only.
    Opportunity / observations remain ranking signals for sitemap selection.
    """
    q = normalize_query(intent.query or {})
    dims = count_seo_dimensions(q)
    blocked = query_has_blocked_seo_attributes(intent.query or {})
    checks: list[dict[str, Any]] = []

    # PRIMARY criterion
    checks.append(
        {
            "label": f"Minimum search filters ({cfg.min_dimensions_for_index})",
            "passed": dims >= cfg.min_dimensions_for_index,
            "detail": f"{dims} meaningful filter{'s' if dims != 1 else ''}",
            "hard": True,
            "primary": True,
        }
    )

    checks.append(
        {
            "label": f"Minimum quality ({cfg.min_quality_for_index:.0f}%)",
            "passed": float(intent.quality_score or 0) >= cfg.min_quality_for_index,
            "detail": f"Quality {float(intent.quality_score or 0):.0f}%",
            "hard": True,
        }
    )

    # Optional secondary safety (0 = disabled)
    if cfg.min_verified_for_index > 0:
        checks.append(
            {
                "label": f"Matching properties safety ({cfg.min_verified_for_index})",
                "passed": intent.match_count >= cfg.min_verified_for_index,
                "detail": f"{intent.match_count} matching propert{'y' if intent.match_count == 1 else 'ies'}",
                "hard": True,
                "secondary": True,
            }
        )
    else:
        checks.append(
            {
                "label": "Matching properties safety",
                "passed": True,
                "detail": "Disabled (optional)",
                "hard": False,
                "secondary": True,
            }
        )

    if blocked:
        checks.append(
            {
                "label": "Allowed SEO attributes only",
                "passed": False,
                "detail": f"Disallowed: {', '.join(blocked)}",
                "hard": True,
            }
        )
    else:
        checks.append({"label": "Allowed SEO attributes only", "passed": True, "detail": "No blocked attributes", "hard": True})

    has_title = bool((intent.h1 or intent.title or "").strip())
    checks.append(
        {
            "label": "Useful page content",
            "passed": has_title,
            "detail": "Has title" if has_title else "Missing title",
            "hard": True,
        }
    )

    # Ranking signals (informational — do not block eligibility)
    checks.append(
        {
            "label": "Search opportunity (ranking)",
            "passed": True,
            "detail": f"Opportunity {float(intent.opportunity_score or 0):.0f}",
            "hard": False,
        }
    )
    checks.append(
        {
            "label": "Page enabled",
            "passed": bool(intent.is_enabled) and intent.index_status != SearchIndexStatus.DISABLED.value,
            "detail": "Enabled" if intent.is_enabled else "Disabled",
            "hard": True,
        }
    )

    hard_checks = [c for c in checks if c.get("hard", True)]
    eligible = all(c["passed"] for c in hard_checks)

    failed = [c for c in hard_checks if not c["passed"]]
    return {
        "eligible": eligible,
        "checks": checks,
        "dimensions": dims,
        "filter_count": dims,
        "failed_count": len(failed),
        "summary": (
            "Eligible for SEO indexing"
            if eligible
            else f"Excluded — {failed[0]['detail'] if failed else 'rules not met'}"
        ),
    }


def evaluate_automatic_eligibility(intent: SearchIntent, cfg: IntentAutomationConfig) -> str:
    if not intent.is_enabled or intent.index_status == SearchIndexStatus.DISABLED.value:
        return AutomaticEligibility.EXCLUDED.value
    details = build_eligibility_checks(intent, cfg)
    return AutomaticEligibility.ELIGIBLE.value if details["eligible"] else AutomaticEligibility.EXCLUDED.value


def apply_automatic_statuses(intent: SearchIntent, cfg: IntentAutomationConfig) -> None:
    """Apply automatic index + provisional sitemap from eligibility. Skipped when manual override."""
    if is_manual_override(intent):
        return
    if not intent.is_enabled or intent.index_status == SearchIndexStatus.DISABLED.value:
        intent.automatic_eligibility = AutomaticEligibility.EXCLUDED.value
        return

    intent.automatic_eligibility = evaluate_automatic_eligibility(intent, cfg)
    intent.last_evaluated_at = _now()

    if not cfg.allow_auto_index:
        if intent.index_status not in {SearchIndexStatus.DISABLED.value}:
            # Keep READY visible when eligible; otherwise noindex below-threshold pages
            if intent.automatic_eligibility == AutomaticEligibility.ELIGIBLE.value:
                if intent.index_status == SearchIndexStatus.INDEXABLE.value:
                    pass
                elif intent.index_status not in {
                    SearchIndexStatus.DISCOVERED.value,
                    SearchIndexStatus.DRAFT.value,
                }:
                    intent.index_status = SearchIndexStatus.DRAFT.value
                intent.status_reason = "READY — waiting for manual publish (auto-index off)"
            else:
                intent.index_status = SearchIndexStatus.NOINDEX.value
                details = build_eligibility_checks(intent, cfg)
                failed = [c for c in details["checks"] if not c["passed"] and c.get("hard", True)]
                reason = failed[0]["detail"] if failed else "Does not meet SEO thresholds"
                intent.status_reason = f"Excluded: {reason}"
        intent.sitemap_status = SitemapStatus.EXCLUDED.value
        return

    if intent.automatic_eligibility == AutomaticEligibility.ELIGIBLE.value:
        intent.index_status = SearchIndexStatus.INDEXABLE.value
        intent.status_reason = (
            f"Auto-indexable: {build_eligibility_checks(intent, cfg)['filter_count']} search filters, "
            f"quality {float(intent.quality_score or 0):.0f}%"
            + (
                f", {intent.match_count} matching properties"
                if cfg.min_verified_for_index > 0
                else ""
            )
        )
        # Provisional include — apply_sitemap_cap keeps only the strongest max_sitemap_urls
        if cfg.allow_sitemap_inclusion:
            intent.sitemap_status = SitemapStatus.INCLUDED.value
        else:
            intent.sitemap_status = SitemapStatus.EXCLUDED.value
    else:
        details = build_eligibility_checks(intent, cfg)
        failed = [c for c in details["checks"] if not c["passed"] and c.get("hard", True)]
        reason = failed[0]["detail"] if failed else "Does not meet SEO thresholds"
        intent.index_status = SearchIndexStatus.NOINDEX.value
        intent.status_reason = f"Excluded: {reason}"
        intent.sitemap_status = SitemapStatus.EXCLUDED.value

    enforce_sitemap_rules(intent.index_status, intent.sitemap_status)


def sitemap_priority_key(intent: SearchIntent) -> tuple:
    """Higher tuple = stronger sitemap candidate.

    Order: more meaningful search filters → quality → opportunity →
    supporting data completeness → matching properties → freshness.
    """
    q = normalize_query(intent.query or {})
    dims = count_seo_dimensions(q)
    completeness = dims
    if (intent.intro_html or "").strip():
        completeness += 2
    if (intent.meta_description or "").strip():
        completeness += 1
    completeness += min(int(intent.matching_observation_count or 0), 10)
    ts = intent.last_calculated_at or intent.last_evaluated_at or intent.updated_at or intent.last_built_at
    freshness = float(ts.timestamp()) if ts is not None else 0.0
    return (
        dims,
        float(intent.quality_score or 0),
        float(intent.opportunity_score or 0),
        completeness,
        int(intent.match_count or 0),
        freshness,
    )


def apply_sitemap_cap(intents: list[SearchIntent], cfg: IntentAutomationConfig) -> dict[str, int]:
    """Keep at most max_sitemap_urls search pages included (manual includes reserved first)."""
    included = 0
    excluded = 0

    if not cfg.allow_sitemap_inclusion:
        for intent in intents:
            if is_manual_override(intent) and intent.sitemap_status == SitemapStatus.INCLUDED.value:
                if intent.index_status == SearchIndexStatus.INDEXABLE.value:
                    included += 1
                    continue
            if intent.index_status != SearchIndexStatus.INDEXABLE.value:
                intent.sitemap_status = SitemapStatus.EXCLUDED.value
                excluded += 1
                continue
            if is_manual_override(intent) and intent.sitemap_status == SitemapStatus.EXCLUDED.value:
                excluded += 1
                continue
            intent.sitemap_status = SitemapStatus.EXCLUDED.value
            excluded += 1
        return {"sitemap_included": included, "sitemap_excluded": excluded, "max_sitemap_urls": cfg.max_sitemap_urls}

    eligible_pool: list[SearchIntent] = []
    manual_included: list[SearchIntent] = []

    for intent in intents:
        if intent.index_status != SearchIndexStatus.INDEXABLE.value:
            intent.sitemap_status = SitemapStatus.EXCLUDED.value
            excluded += 1
            continue
        if not intent.is_enabled:
            intent.sitemap_status = SitemapStatus.EXCLUDED.value
            excluded += 1
            continue
        path = (intent.path or "").strip()
        if not path.startswith("/rentals/") or path.count("/") < 3:
            intent.sitemap_status = SitemapStatus.EXCLUDED.value
            excluded += 1
            continue
        if is_manual_override(intent):
            if intent.sitemap_status == SitemapStatus.INCLUDED.value:
                manual_included.append(intent)
            else:
                excluded += 1
            continue
        eligible_pool.append(intent)

    # Manual includes always keep their slots (may briefly exceed cap if many manuals)
    for intent in manual_included:
        intent.sitemap_status = SitemapStatus.INCLUDED.value
        included += 1

    slots = max(0, int(cfg.max_sitemap_urls) - len(manual_included))
    eligible_pool.sort(key=sitemap_priority_key, reverse=True)
    for intent in eligible_pool[:slots]:
        intent.sitemap_status = SitemapStatus.INCLUDED.value
        included += 1
    for intent in eligible_pool[slots:]:
        intent.sitemap_status = SitemapStatus.EXCLUDED.value
        excluded += 1

    return {
        "sitemap_included": included,
        "sitemap_excluded": excluded,
        "max_sitemap_urls": cfg.max_sitemap_urls,
        "auto_selected": min(slots, len(eligible_pool)),
        "manual_included": len(manual_included),
    }


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
    index_stats = await apply_index_rules(db, cfg)

    result = await db.execute(select(SearchIntent))
    intents = list(result.scalars().all())
    for intent in intents:
        if is_manual_override(intent):
            intent.automatic_eligibility = evaluate_automatic_eligibility(intent, cfg)
            intent.last_evaluated_at = _now()
            sync_sitemap_with_index(intent)

    sitemap_stats = apply_sitemap_cap(intents, cfg)
    await db.flush()
    after = await landing_page_stats(db)
    return {
        "before": before,
        "after": after,
        "index_rules": index_stats,
        "sitemap": sitemap_stats,
    }


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

# Sort modes that require in-memory ranking (not a DB column)
MEMORY_SORTS = frozenset({"filter_count", "filters", "best"})


def _intent_sort_key(intent: SearchIntent, sort_by: str):
    if sort_by in {"filter_count", "filters"}:
        return count_seo_dimensions(normalize_query(intent.query or {}))
    if sort_by == "best":
        return sitemap_priority_key(intent)
    return getattr(intent, sort_by, None) or 0


def enrich_intent_admin_row(intent: SearchIntent) -> dict[str, Any]:
    """Add plain-English filter display for admin Search Pages table."""
    from app.services.landing_pages import filters_label_from_query, key_attributes_from_query

    q = intent.query or {}
    filters = key_attributes_from_query(q)
    dims = count_seo_dimensions(normalize_query(q))
    return {
        "filter_count": dims,
        "filters_label": filters_label_from_query(q) or "—",
        "filters": filters,
        "dimensions": dims,
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
    simple_status: str | None = None,
    attribute: str | None = None,
    sort_by: str = "updated_at",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    from app.services.seo_attributes import intent_uses_attribute

    def _matches_row_filters(i: SearchIntent) -> bool:
        if search:
            term = search.strip().lower()
            blob = f"{i.path} {i.title} {i.h1} {i.intent_slug}".lower()
            if term not in blob:
                return False
        if location and i.location_slug != location.lower():
            return False
        if property_type:
            q = i.query or {}
            if str(q.get("property_type") or "").lower() != property_type.lower():
                return False
        if index_status and i.index_status != index_status:
            return False
        if sitemap_status and i.sitemap_status != sitemap_status:
            return False
        if automatic_eligibility and i.automatic_eligibility != automatic_eligibility:
            return False
        if seo_control and i.seo_control != seo_control:
            return False
        if simple_status == "published" and i.index_status != SearchIndexStatus.INDEXABLE.value:
            return False
        if simple_status == "noindex" and i.index_status != SearchIndexStatus.NOINDEX.value:
            return False
        if simple_status == "ready":
            if i.automatic_eligibility != AutomaticEligibility.ELIGIBLE.value:
                return False
            if i.index_status in {
                SearchIndexStatus.INDEXABLE.value,
                SearchIndexStatus.NOINDEX.value,
                SearchIndexStatus.DISABLED.value,
            }:
                return False
        if simple_status == "not_ready":
            if i.automatic_eligibility != AutomaticEligibility.EXCLUDED.value:
                return False
            if i.index_status in {
                SearchIndexStatus.INDEXABLE.value,
                SearchIndexStatus.NOINDEX.value,
                SearchIndexStatus.DISABLED.value,
            }:
                return False
        if attribute and not intent_uses_attribute(i.query or {}, attribute):
            return False
        return True

    needs_memory = bool(attribute) or sort_by in MEMORY_SORTS or sort_by == "filter_count"

    if needs_memory:
        all_rows = list((await db.execute(select(SearchIntent))).scalars().all())
        filtered = [i for i in all_rows if _matches_row_filters(i)]
        reverse = sort_dir.lower() != "asc"
        if sort_by == "best":
            filtered.sort(key=lambda i: _intent_sort_key(i, "best"), reverse=True)
        else:
            filtered.sort(key=lambda i: _intent_sort_key(i, sort_by), reverse=reverse)
        total = len(filtered)
        rows = filtered[(page - 1) * page_size : page * page_size]
        return {"total": total, "page": page, "page_size": page_size, "items": rows}

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
    if simple_status == "published":
        q = q.where(SearchIntent.index_status == SearchIndexStatus.INDEXABLE.value)
        count_q = count_q.where(SearchIntent.index_status == SearchIndexStatus.INDEXABLE.value)
    elif simple_status == "noindex":
        q = q.where(SearchIntent.index_status == SearchIndexStatus.NOINDEX.value)
        count_q = count_q.where(SearchIntent.index_status == SearchIndexStatus.NOINDEX.value)
    elif simple_status == "ready":
        q = q.where(
            SearchIntent.automatic_eligibility == AutomaticEligibility.ELIGIBLE.value,
            SearchIntent.index_status.notin_(
                [SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.NOINDEX.value, SearchIndexStatus.DISABLED.value]
            ),
        )
        count_q = count_q.where(
            SearchIntent.automatic_eligibility == AutomaticEligibility.ELIGIBLE.value,
            SearchIntent.index_status.notin_(
                [SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.NOINDEX.value, SearchIndexStatus.DISABLED.value]
            ),
        )
    elif simple_status == "not_ready":
        q = q.where(
            SearchIntent.automatic_eligibility == AutomaticEligibility.EXCLUDED.value,
            SearchIntent.index_status.notin_(
                [SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.NOINDEX.value, SearchIndexStatus.DISABLED.value]
            ),
        )
        count_q = count_q.where(
            SearchIntent.automatic_eligibility == AutomaticEligibility.EXCLUDED.value,
            SearchIntent.index_status.notin_(
                [SearchIndexStatus.INDEXABLE.value, SearchIndexStatus.NOINDEX.value, SearchIndexStatus.DISABLED.value]
            ),
        )

    col = SORT_COLUMNS.get(sort_by, SearchIntent.updated_at)
    q = q.order_by(col.desc() if sort_dir.lower() == "desc" else col.asc())
    total = int((await db.execute(count_q)).scalar() or 0)
    rows = list((await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all())
    return {"total": total, "page": page, "page_size": page_size, "items": rows}
