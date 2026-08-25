"""Unit tests for SEO eligibility — search filters + intent strength + sitemap cap."""

from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.intent_config import IntentAutomationConfig
from app.services.seo_attributes import classify_search_intent_strength
from app.services.seo_landing import (
    apply_sitemap_cap,
    build_eligibility_checks,
    evaluate_automatic_eligibility,
    sitemap_priority_key,
)


def _intent(**kwargs):
    base = {
        "query": {"location": "kigali", "furnished": True},
        "match_count": 5,
        "quality_score": 60.0,
        "opportunity_score": 10.0,
        "matching_observation_count": 0,
        "is_enabled": True,
        "index_status": "draft",
        "intro_html": "",
        "meta_description": "",
        "title": "Test",
        "h1": "Test",
        "last_calculated_at": None,
        "last_evaluated_at": None,
        "updated_at": None,
        "last_built_at": None,
    }
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_filter_count_is_primary_gate():
    """Weak filters fail even with many properties and high quality."""
    cfg = IntentAutomationConfig(
        min_verified_for_index=1,
        min_dimensions_for_index=3,
        max_dimensions_for_index=5,
        min_quality_for_index=50.0,
    )
    # Only Kigali + furnished = 2 filters
    intent = _intent(match_count=20, quality_score=96.0, query={"location": "kigali", "furnished": True})
    details = build_eligibility_checks(intent, cfg)
    assert details["filter_count"] == 2
    assert details["eligible"] is False
    assert details["intent_strength"] == "weak"
    assert evaluate_automatic_eligibility(intent, cfg) == "excluded"
    failed = [c for c in details["checks"] if not c["passed"] and c.get("hard", True)]
    assert any("filter" in c["label"].lower() for c in failed)


def test_over_specific_filters_are_weak_and_excluded():
    cfg = IntentAutomationConfig(
        min_dimensions_for_index=3,
        max_dimensions_for_index=5,
        min_quality_for_index=50.0,
    )
    intent = _intent(
        quality_score=80.0,
        query={
            "location": "kigali",
            "bedrooms": 2,
            "bathrooms": 2,
            "property_type": "apartment",
            "furnished": True,
            "max_price_usd": 1200,
            "amenities": ["parking"],
        },
    )
    details = build_eligibility_checks(intent, cfg)
    assert details["filter_count"] == 7
    assert details["intent_strength"] == "weak"
    assert details["eligible"] is False


def test_strong_filters_pass_with_quality():
    cfg = IntentAutomationConfig(
        min_verified_for_index=1,
        min_dimensions_for_index=3,
        max_dimensions_for_index=5,
        min_quality_for_index=50.0,
    )
    intent = _intent(
        match_count=2,
        quality_score=55.0,
        query={
            "location": "kigali",
            "bedrooms": 2,
            "property_type": "apartment",
            "max_price_usd": 1200,
        },
    )
    details = build_eligibility_checks(intent, cfg)
    assert details["filter_count"] == 4
    assert details["intent_strength"] == "strong"
    assert details["eligible"] is True
    assert evaluate_automatic_eligibility(intent, cfg) == "eligible"


def test_classify_strong_and_useful_patterns():
    strong_budget = {
        "location": "kibagabaga",
        "bedrooms": 2,
        "property_type": "apartment",
        "max_price_usd": 1000,
    }
    strong_furnished = {
        "location": "kibagabaga",
        "bedrooms": 3,
        "property_type": "house",
        "furnished": True,
    }
    useful = {"location": "kigali", "bedrooms": 2, "property_type": "apartment"}
    weak = {"location": "kigali", "furnished": True}
    assert classify_search_intent_strength(strong_budget) == ("strong", 3)
    assert classify_search_intent_strength(strong_furnished) == ("strong", 3)
    assert classify_search_intent_strength(useful) == ("useful", 2)
    assert classify_search_intent_strength(weak) == ("weak", 0)


def test_property_safety_optional_when_disabled():
    cfg = IntentAutomationConfig(
        require_min_properties=False,
        min_verified_for_index=5,
        min_dimensions_for_index=2,
        max_dimensions_for_index=5,
        min_quality_for_index=50.0,
    )
    intent = _intent(match_count=0, quality_score=60.0, query={"location": "kibagabaga", "furnished": True})
    details = build_eligibility_checks(intent, cfg)
    assert details["eligible"] is True


def test_property_safety_blocks_when_enabled():
    cfg = IntentAutomationConfig(
        require_min_properties=True,
        min_verified_for_index=5,
        min_dimensions_for_index=2,
        max_dimensions_for_index=5,
        min_quality_for_index=50.0,
    )
    intent = _intent(match_count=3, quality_score=96.0)
    details = build_eligibility_checks(intent, cfg)
    assert details["eligible"] is False
    failed = [c for c in details["checks"] if not c["passed"] and c.get("hard", True)]
    assert any("propert" in c["label"].lower() for c in failed)


def test_intent_optional_when_disabled():
    cfg = IntentAutomationConfig(
        require_min_intent=False,
        min_intent_for_index=100.0,
        min_dimensions_for_index=2,
        max_dimensions_for_index=5,
        min_quality_for_index=50.0,
    )
    intent = _intent(opportunity_score=5.0, query={"location": "kigali", "furnished": True})
    assert build_eligibility_checks(intent, cfg)["eligible"] is True


def test_intent_blocks_when_enabled():
    cfg = IntentAutomationConfig(
        require_min_intent=True,
        min_intent_for_index=80.0,
        min_dimensions_for_index=2,
        max_dimensions_for_index=5,
        min_quality_for_index=50.0,
    )
    intent = _intent(opportunity_score=5.0, query={"location": "kigali", "furnished": True})
    details = build_eligibility_checks(intent, cfg)
    assert details["eligible"] is False
    failed = [c for c in details["checks"] if not c["passed"] and c.get("hard", True)]
    assert any("intent" in c["label"].lower() for c in failed)


def test_sitemap_cap_prioritizes_strong_intent():
    cfg = IntentAutomationConfig(max_sitemap_urls=2, allow_sitemap_inclusion=True)

    def make(id_, filters_query, quality=70, matches=5, opp=40):
        return SimpleNamespace(
            id=id_,
            index_status="indexable",
            is_enabled=True,
            path=f"/rentals/kigali/page-{id_}",
            sitemap_status="included",
            seo_control="automatic",
            locked_by_admin=False,
            quality_score=quality,
            match_count=matches,
            opportunity_score=opp,
            matching_observation_count=0,
            intro_html="x" * 50,
            meta_description="meta",
            title="Test",
            h1="Test",
            query=filters_query,
            last_calculated_at=None,
            last_evaluated_at=None,
            updated_at=None,
            last_built_at=None,
        )

    weak = make(1, {"location": "kigali", "furnished": True}, quality=99, matches=50)
    strong_a = make(
        2,
        {"location": "kigali", "bedrooms": 2, "property_type": "apartment", "max_price_usd": 1200},
        quality=60,
        matches=3,
    )
    strong_b = make(
        3,
        {"location": "kigali", "bedrooms": 3, "property_type": "house", "furnished": True},
        quality=55,
        matches=4,
    )
    stats = apply_sitemap_cap([weak, strong_a, strong_b], cfg)
    assert stats["sitemap_included"] == 2
    assert strong_a.sitemap_status == "included"
    assert strong_b.sitemap_status == "included"
    assert weak.sitemap_status == "excluded"


def test_sitemap_priority_prefers_strong_over_useful():
    useful = _intent(
        query={"location": "kigali", "bedrooms": 2, "property_type": "apartment"},
        quality_score=99,
        match_count=50,
    )
    strong = _intent(
        query={"location": "kigali", "bedrooms": 2, "property_type": "apartment", "max_price_usd": 1200},
        quality_score=55,
        match_count=3,
    )
    assert sitemap_priority_key(strong) > sitemap_priority_key(useful)


def test_changing_max_sitemap_urls_changes_inclusion():
    """Reducing the hard cap after ranking must drop lower-ranked pages from sitemap."""
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)

    def make(id_, strength_query, matches):
        return SimpleNamespace(
            id=id_,
            index_status="indexable",
            is_enabled=True,
            path=f"/rentals/kigali/page-{id_}",
            sitemap_status="included",
            seo_control="automatic",
            locked_by_admin=False,
            quality_score=70.0,
            match_count=matches,
            opportunity_score=40.0,
            matching_observation_count=0,
            intro_html="content",
            meta_description="meta",
            title="Test",
            h1="Test",
            query=strength_query,
            last_calculated_at=now,
            last_evaluated_at=now,
            updated_at=now,
            last_built_at=now,
        )

    pages = [
        make(1, {"location": "a", "bedrooms": 2, "property_type": "apartment", "max_price_usd": 900}, 10),
        make(2, {"location": "b", "bedrooms": 2, "property_type": "apartment", "furnished": True}, 8),
        make(3, {"location": "c", "bedrooms": 2, "property_type": "apartment"}, 6),
        make(4, {"location": "d", "bedrooms": 3, "property_type": "house"}, 4),
    ]
    wide = apply_sitemap_cap(pages, IntentAutomationConfig(max_sitemap_urls=3, allow_sitemap_inclusion=True))
    assert wide["sitemap_included"] == 3
    assert sum(1 for p in pages if p.sitemap_status == "included") == 3

    tight = apply_sitemap_cap(pages, IntentAutomationConfig(max_sitemap_urls=1, allow_sitemap_inclusion=True))
    assert tight["sitemap_included"] == 1
    assert tight["max_sitemap_urls"] == 1
    included = [p for p in pages if p.sitemap_status == "included"]
    assert len(included) == 1
    assert included[0].id == 1  # strongest: strong intent + most matches
