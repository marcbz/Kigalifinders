"""End-to-end simulation of SEO admin actions → DB fields → sitemap selection."""

from types import SimpleNamespace

from app.services.intent_config import IntentAutomationConfig
from app.services.seo_landing import (
    apply_sitemap_cap,
    build_eligibility_checks,
    evaluate_automatic_eligibility,
    set_index_status_manual,
    set_sitemap_status_manual,
    sync_sitemap_with_index,
)


def _page(**kwargs):
    base = {
        "id": "p",
        "query": {"location": "kigali", "bedrooms": 2, "property_type": "apartment", "max_price_usd": 1200},
        "match_count": 4,
        "quality_score": 70.0,
        "opportunity_score": 50.0,
        "matching_observation_count": 2,
        "is_enabled": True,
        "index_status": "draft",
        "sitemap_status": "excluded",
        "seo_control": "automatic",
        "locked_by_admin": False,
        "automatic_eligibility": "excluded",
        "intro_html": "Intro",
        "meta_description": "Meta",
        "title": "Kigali 2 bed apartments under $1200",
        "h1": "Kigali 2 bed apartments under $1200",
        "path": "/rentals/kigali/2-bed-apartments-under-1200",
        "last_calculated_at": None,
        "last_evaluated_at": None,
        "updated_at": None,
        "last_built_at": None,
    }
    base.update(kwargs)
    return SimpleNamespace(**base)


def _sitemap_paths(intents):
    return [
        i.path
        for i in intents
        if i.is_enabled
        and i.index_status == "indexable"
        and i.sitemap_status == "included"
        and i.path.startswith("/rentals/")
        and i.path.count("/") >= 3
    ]


def test_full_admin_flow_quality_gate_index_sitemap_noindex():
    """Mirrors required QA steps 1–12 without a live DB."""
    # 1–2. Raise minimum quality → page becomes ineligible
    strict = IntentAutomationConfig(
        min_dimensions_for_index=3,
        min_quality_for_index=90.0,
        max_sitemap_urls=100,
        min_verified_for_index=0,
        allow_sitemap_inclusion=True,
        allow_auto_index=True,
    )
    page = _page(quality_score=70.0)
    assert evaluate_automatic_eligibility(page, strict) == "excluded"

    # 3. Lower quality threshold → eligible
    loose = IntentAutomationConfig(
        min_dimensions_for_index=3,
        min_quality_for_index=50.0,
        max_sitemap_urls=100,
        min_verified_for_index=0,
        allow_sitemap_inclusion=True,
        allow_auto_index=True,
    )
    details = build_eligibility_checks(page, loose)
    assert details["eligible"] is True
    assert details["filter_count"] == 4
    page.automatic_eligibility = evaluate_automatic_eligibility(page, loose)
    assert page.automatic_eligibility == "eligible"

    # 4–5. Manual Index → DB index_status + manual override
    set_index_status_manual(page, "indexable")
    assert page.index_status == "indexable"
    assert page.seo_control == "manual"
    assert page.locked_by_admin is True

    # 6–7. Include in sitemap → appears in sitemap selection
    set_sitemap_status_manual(page, "included")
    apply_sitemap_cap([page], loose)
    assert page.sitemap_status == "included"
    assert page.path in _sitemap_paths([page])

    # 9–10. Exclude → disappears from sitemap
    set_sitemap_status_manual(page, "excluded")
    apply_sitemap_cap([page], loose)
    assert page.sitemap_status == "excluded"
    assert page.path not in _sitemap_paths([page])

    # Re-include then noindex
    set_sitemap_status_manual(page, "included")
    assert page.sitemap_status == "included"

    # 11–12. Noindex → sitemap exclusion remains
    set_index_status_manual(page, "noindex")
    sync_sitemap_with_index(page)
    assert page.index_status == "noindex"
    assert page.sitemap_status == "excluded"
    assert page.path not in _sitemap_paths([page])


def test_bulk_cap_and_sort_signals():
    cfg = IntentAutomationConfig(max_sitemap_urls=2, allow_sitemap_inclusion=True)
    pages = [
        _page(
            id="weak",
            path="/rentals/kigali/weak",
            query={"location": "kigali", "property_type": "apartment"},
            quality_score=99,
        ),
        _page(
            id="mid",
            path="/rentals/kigali/mid",
            query={"location": "kigali", "bedrooms": 2, "property_type": "apartment"},
            quality_score=60,
        ),
        _page(
            id="strong",
            path="/rentals/kigali/strong",
            query={
                "location": "kigali",
                "bedrooms": 2,
                "property_type": "apartment",
                "max_price_usd": 1200,
                "furnished": True,
            },
            quality_score=55,
        ),
    ]
    for p in pages:
        set_index_status_manual(p, "indexable")
        set_sitemap_status_manual(p, "included")
    apply_sitemap_cap(pages, cfg)
    included = {p.path for p in pages if p.sitemap_status == "included"}
    assert "/rentals/kigali/strong" in included
    assert "/rentals/kigali/mid" in included
    assert "/rentals/kigali/weak" not in included
