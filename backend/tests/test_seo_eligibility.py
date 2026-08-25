"""Unit tests for SEO eligibility — search filters are the primary criterion."""

from types import SimpleNamespace

from app.services.intent_config import IntentAutomationConfig
from app.services.seo_landing import build_eligibility_checks, evaluate_automatic_eligibility


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
    }
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_filter_count_is_primary_gate():
    """Weak filters fail even with many properties and high quality."""
    cfg = IntentAutomationConfig(
        min_verified_for_index=1,
        min_dimensions_for_index=3,
        min_quality_for_index=50.0,
    )
    # Only Kigali + furnished = 2 filters
    intent = _intent(match_count=20, quality_score=96.0, query={"location": "kigali", "furnished": True})
    details = build_eligibility_checks(intent, cfg)
    assert details["filter_count"] == 2
    assert details["eligible"] is False
    assert evaluate_automatic_eligibility(intent, cfg) == "excluded"
    failed = [c for c in details["checks"] if not c["passed"] and c.get("hard", True)]
    assert any("filter" in c["label"].lower() for c in failed)


def test_strong_filters_pass_with_quality():
    cfg = IntentAutomationConfig(
        min_verified_for_index=1,
        min_dimensions_for_index=3,
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
    assert details["eligible"] is True
    assert evaluate_automatic_eligibility(intent, cfg) == "eligible"


def test_property_safety_optional_when_disabled():
    cfg = IntentAutomationConfig(
        require_min_properties=False,
        min_verified_for_index=5,
        min_dimensions_for_index=2,
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
        min_quality_for_index=50.0,
    )
    intent = _intent(opportunity_score=5.0, query={"location": "kigali", "furnished": True})
    assert build_eligibility_checks(intent, cfg)["eligible"] is True


def test_intent_blocks_when_enabled():
    cfg = IntentAutomationConfig(
        require_min_intent=True,
        min_intent_for_index=80.0,
        min_dimensions_for_index=2,
        min_quality_for_index=50.0,
    )
    intent = _intent(opportunity_score=5.0, query={"location": "kigali", "furnished": True})
    details = build_eligibility_checks(intent, cfg)
    assert details["eligible"] is False
    failed = [c for c in details["checks"] if not c["passed"] and c.get("hard", True)]
    assert any("intent" in c["label"].lower() for c in failed)


def test_sitemap_cap_prioritizes_more_filters():
    from app.services.seo_landing import apply_sitemap_cap

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
    assert weak.sitemap_status == "excluded"  # fewer filters despite higher quality
