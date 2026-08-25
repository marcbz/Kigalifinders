"""Unit tests for SEO publishing-rule READY gates."""

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


def test_three_properties_high_quality_not_ready():
    cfg = IntentAutomationConfig(
        min_verified_for_index=5,
        min_dimensions_for_index=2,
        min_quality_for_index=50.0,
    )
    intent = _intent(match_count=3, quality_score=96.0)
    details = build_eligibility_checks(intent, cfg)
    assert details["eligible"] is False
    assert evaluate_automatic_eligibility(intent, cfg) == "excluded"
    failed = [c for c in details["checks"] if not c["passed"] and c.get("hard", True)]
    assert any("matching" in c["label"].lower() for c in failed)


def test_meets_all_three_thresholds_is_ready():
    cfg = IntentAutomationConfig(
        min_verified_for_index=5,
        min_dimensions_for_index=2,
        min_quality_for_index=50.0,
    )
    intent = _intent(match_count=5, quality_score=50.0, query={"location": "kibagabaga", "furnished": True})
    details = build_eligibility_checks(intent, cfg)
    assert details["dimensions"] >= 2
    assert details["eligible"] is True
    assert evaluate_automatic_eligibility(intent, cfg) == "eligible"


def test_sitemap_cap_keeps_strongest():
    from app.services.seo_landing import apply_sitemap_cap

    cfg = IntentAutomationConfig(max_sitemap_urls=2, allow_sitemap_inclusion=True)

    def make(id_, quality, matches, opp):
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
            query={"location": "kigali", "furnished": True},
            last_calculated_at=None,
            last_evaluated_at=None,
            updated_at=None,
            last_built_at=None,
        )

    a = make(1, 90, 10, 50)
    b = make(2, 80, 20, 40)
    c = make(3, 70, 5, 90)
    stats = apply_sitemap_cap([a, b, c], cfg)
    assert stats["sitemap_included"] == 2
    assert a.sitemap_status == "included"  # highest quality
    assert b.sitemap_status == "included"  # next
    assert c.sitemap_status == "excluded"
