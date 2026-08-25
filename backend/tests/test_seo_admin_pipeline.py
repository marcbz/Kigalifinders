"""Integration-style tests for SEO admin pipeline: cap, manual actions, sitemap selection."""

from types import SimpleNamespace

from app.services.intent_config import IntentAutomationConfig
from app.services.seo_landing import (
    apply_sitemap_cap,
    set_index_status_manual,
    set_sitemap_status_manual,
    sitemap_priority_key,
)


def _intent(**kwargs):
    base = {
        "id": "test-id",
        "query": {"location": "kigali", "property_type": "apartment"},
        "match_count": 5,
        "quality_score": 60.0,
        "opportunity_score": 40.0,
        "matching_observation_count": 0,
        "is_enabled": True,
        "index_status": "draft",
        "sitemap_status": "excluded",
        "seo_control": "automatic",
        "locked_by_admin": False,
        "automatic_eligibility": "eligible",
        "intro_html": "",
        "meta_description": "",
        "title": "Test",
        "h1": "Test",
        "path": "/rentals/kigali/test",
        "last_calculated_at": None,
        "last_evaluated_at": None,
        "updated_at": None,
        "last_built_at": None,
    }
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_manual_index_then_include_respects_cap():
    cfg = IntentAutomationConfig(max_sitemap_urls=1, allow_sitemap_inclusion=True)
    a = _intent(
        id="a",
        path="/rentals/kigali/a",
        query={"location": "kigali", "bedrooms": 2, "property_type": "apartment", "max_price_usd": 1200},
    )
    b = _intent(id="b", path="/rentals/kigali/b", query={"location": "kigali", "property_type": "apartment"})

    set_index_status_manual(a, "indexable")
    set_sitemap_status_manual(a, "included")
    set_index_status_manual(b, "indexable")
    set_sitemap_status_manual(b, "included")

    stats = apply_sitemap_cap([a, b], cfg)
    assert stats["sitemap_included"] == 1
    assert a.sitemap_status == "included"
    assert b.sitemap_status == "excluded"


def test_manual_noindex_forces_sitemap_excluded():
    intent = _intent(index_status="indexable", sitemap_status="included")
    set_index_status_manual(intent, "noindex")
    assert intent.index_status == "noindex"
    assert intent.sitemap_status == "excluded"


def test_sitemap_priority_prefers_more_filters():
    weak = _intent(query={"location": "kigali", "property_type": "apartment"}, quality_score=99)
    strong = _intent(
        query={"location": "kigali", "bedrooms": 2, "property_type": "apartment", "max_price_usd": 1200},
        quality_score=55,
    )
    assert sitemap_priority_key(strong) > sitemap_priority_key(weak)


def test_sitemap_xml_items_match_db_included_status():
    """Simulate rentals_sitemap intent selection — no second cap slice."""
    cfg = IntentAutomationConfig(max_sitemap_urls=100, allow_sitemap_inclusion=True)
    intents = [
        _intent(
            path=f"/rentals/kigali/page-{n}",
            index_status="indexable",
            sitemap_status="included",
            query={"location": "kigali", "bedrooms": n, "property_type": "apartment"},
        )
        for n in range(1, 6)
    ]
    apply_sitemap_cap(intents, cfg)
    xml_paths = [
        i.path
        for i in intents
        if i.index_status == "indexable"
        and i.sitemap_status == "included"
        and i.path.startswith("/rentals/")
        and i.path.count("/") >= 3
    ]
    db_included = [i.path for i in intents if i.sitemap_status == "included"]
    assert xml_paths == db_included
