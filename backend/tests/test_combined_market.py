"""Regression tests for live combined-market research eligibility."""

from datetime import datetime, timedelta, timezone

import pytest

from app.services.combined_market import (
    EXTERNAL_MAX_AGE_DAYS,
    _external_observation_is_fresh,
    _furnished_breakdown,
    compute_stats,
    furnishing_premium,
)
from app.services.market_estimator import estimate_market_rent


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
    assert breakdown["furnished"]["comparison"] == "premium_adjusted"
    assert breakdown["furnished"]["median_usd"] is not None
    assert breakdown["unfurnished"]["median_usd"] is not None
    assert breakdown["furnished"]["median_usd"] > breakdown["unfurnished"]["median_usd"]


def _live_like_rows():
    """Shape of the live data that produced unfurnished > furnished under the old method."""
    rows = []
    rows += [_row(500 + 5 * i, bedrooms=1, is_furnished=True) for i in range(15)]
    rows += [_row(700 + 4 * i, bedrooms=2, is_furnished=True) for i in range(31)]
    rows += [_row(540 + 10 * i, bedrooms=2, is_furnished=False) for i in range(5)]
    rows += [_row(1000 + 10 * i, bedrooms=3, is_furnished=True) for i in range(26)]
    # A few premium unfurnished 3-beds priced above furnished ones
    rows += [_row(1080 + 20 * i, bedrooms=3, is_furnished=False) for i in range(7)]
    rows += [_row(1400 + 10 * i, bedrooms=4, is_furnished=True) for i in range(36)]
    rows += [_row(1100 + 10 * i, bedrooms=4, is_furnished=False) for i in range(16)]
    # Thin, oddly cheap furnished 5-beds that dragged the old median-of-medians down
    rows += [_row(700 + 20 * i, bedrooms=5, is_furnished=True) for i in range(4)]
    rows += [_row(690 + 20 * i, bedrooms=5, is_furnished=False) for i in range(8)]
    return rows


def test_small_odd_cohorts_cannot_flip_the_furnished_premium():
    breakdown = _furnished_breakdown(_live_like_rows(), use_benchmarks=True)
    f = breakdown["furnished"]["median_usd"]
    u = breakdown["unfurnished"]["median_usd"]
    assert f > u
    assert 1.05 < f / u < 1.5


def test_furnished_split_stays_consistent_with_overall_typical_rent():
    rows = _live_like_rows()
    breakdown = _furnished_breakdown(rows, use_benchmarks=True)
    premium = furnishing_premium(rows)
    overall = estimate_market_rent(rows, use_benchmarks=True)["median_usd"]
    s = premium["furnished_share"]
    blended = s * breakdown["furnished"]["median_usd"] + (1 - s) * breakdown["unfurnished"]["median_usd"]
    assert blended == pytest.approx(overall, rel=1e-3)


def test_furnished_premium_never_goes_below_parity():
    rows = [
        *[_row(400 + i, bedrooms=2, is_furnished=True) for i in range(40)],
        *[_row(900 + i, bedrooms=2, is_furnished=False) for i in range(40)],
    ]
    assert furnishing_premium(rows)["ratio"] == 1.0
    breakdown = _furnished_breakdown(rows)
    assert breakdown["furnished"]["median_usd"] == breakdown["unfurnished"]["median_usd"]
