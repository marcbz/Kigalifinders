"""Regression tests for live combined-market research eligibility."""

from datetime import datetime, timedelta, timezone

from app.services.combined_market import (
    EXTERNAL_MAX_AGE_DAYS,
    _external_observation_is_fresh,
    _furnished_breakdown,
    compute_stats,
)


def _row(
    usd: float,
    *,
    origin: str = "external",
    observed_at: datetime | None = None,
    bedrooms: int = 3,
    is_furnished: bool | None = None,
) -> dict:
    return {
        "usd": usd,
        "origin": origin,
        "observed_at": observed_at or datetime.now(timezone.utc),
        "bedrooms": bedrooms,
        "is_furnished": is_furnished,
        "dedupe": f"{origin}:{usd}:{bedrooms}:{is_furnished}",
    }


def test_external_observation_freshness_window():
    now = datetime(2026, 9, 17, tzinfo=timezone.utc)
    fresh = now - timedelta(days=EXTERNAL_MAX_AGE_DAYS - 1)
    stale = now - timedelta(days=EXTERNAL_MAX_AGE_DAYS + 1)
    assert _external_observation_is_fresh(fresh, now=now) is True
    assert _external_observation_is_fresh(stale, now=now) is False
    assert _external_observation_is_fresh(None, now=now) is False


def test_combined_stats_keep_external_with_verified():
    """Premium verified inventory must not displace third-party market observations."""
    rows = [
        _row(1500, origin="verified", bedrooms=2),
        _row(1600, origin="verified", bedrooms=2),
        _row(1700, origin="verified", bedrooms=3),
        _row(1800, origin="verified", bedrooms=3),
        _row(1900, origin="verified", bedrooms=3),
        _row(500, origin="external", bedrooms=2),
        _row(550, origin="external", bedrooms=2),
        _row(600, origin="external", bedrooms=2),
        _row(650, origin="external", bedrooms=3),
        _row(700, origin="external", bedrooms=3),
    ]
    combined = compute_stats([r["usd"] for r in rows])
    verified_only = compute_stats([r["usd"] for r in rows if r["origin"] == "verified"])
    assert combined is not None and verified_only is not None
    assert combined["median_usd"] < verified_only["median_usd"]
    assert combined["sample_size"] == len(rows)


def test_furnished_breakdown_uses_bedroom_matched_medians():
    # Mix differs by bedroom: unfurnished 4-beds are expensive; furnished 1-beds are cheaper.
    # A naive global median can look identical; bedroom-matched should keep furnished higher.
    rows = [
        # 1-bed: furnished premium
        *[_row(500 + i, bedrooms=1, is_furnished=True) for i in range(5)],
        *[_row(350 + i, bedrooms=1, is_furnished=False) for i in range(5)],
        # 2-bed: furnished premium
        *[_row(800 + i, bedrooms=2, is_furnished=True) for i in range(5)],
        *[_row(600 + i, bedrooms=2, is_furnished=False) for i in range(5)],
        # Extra expensive unfurnished 4-beds that would pull a global unfurnished median up
        *[_row(2000 + i * 50, bedrooms=4, is_furnished=False) for i in range(8)],
    ]
    breakdown = _furnished_breakdown(rows)
    assert breakdown["furnished"]["comparison"] == "bedroom_matched"
    assert breakdown["furnished"]["median_usd"] is not None
    assert breakdown["unfurnished"]["median_usd"] is not None
    assert breakdown["furnished"]["median_usd"] > breakdown["unfurnished"]["median_usd"]
