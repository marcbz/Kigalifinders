"""Regression tests for live combined-market research eligibility."""

from datetime import datetime, timedelta, timezone

from app.services.combined_market import (
    EXTERNAL_MAX_AGE_DAYS,
    MIN_SAMPLE_VERIFIED_PUBLIC,
    _external_observation_is_fresh,
    _rows_for_public_stats,
    compute_stats,
)


def _row(usd: float, *, origin: str, observed_at: datetime | None = None, bedrooms: int = 3) -> dict:
    return {
        "usd": usd,
        "origin": origin,
        "observed_at": observed_at or datetime.now(timezone.utc),
        "bedrooms": bedrooms,
        "dedupe": f"{origin}:{usd}",
    }


def test_external_observation_freshness_window():
    now = datetime(2026, 9, 17, tzinfo=timezone.utc)
    fresh = now - timedelta(days=EXTERNAL_MAX_AGE_DAYS - 1)
    stale = now - timedelta(days=EXTERNAL_MAX_AGE_DAYS + 1)
    assert _external_observation_is_fresh(fresh, now=now) is True
    assert _external_observation_is_fresh(stale, now=now) is False
    assert _external_observation_is_fresh(None, now=now) is False


def test_public_stats_prefer_verified_when_sample_is_strong():
    rows = [
        *[_row(1000 + i * 10, origin="verified") for i in range(MIN_SAMPLE_VERIFIED_PUBLIC)],
        _row(400, origin="external"),
        _row(450, origin="external"),
        _row(500, origin="external"),
    ]
    selected = _rows_for_public_stats(rows)
    assert all(r["origin"] == "verified" for r in selected)
    assert len(selected) == MIN_SAMPLE_VERIFIED_PUBLIC

    # New high verified prices should move the median once externals are dropped.
    verified_median = compute_stats([r["usd"] for r in selected])["median_usd"]
    combined_median = compute_stats([r["usd"] for r in rows])["median_usd"]
    assert verified_median > combined_median


def test_public_stats_keep_external_when_verified_sample_is_thin():
    rows = [
        _row(1500, origin="verified"),
        _row(1600, origin="verified"),
        _row(700, origin="external"),
        _row(750, origin="external"),
        _row(800, origin="external"),
    ]
    selected = _rows_for_public_stats(rows)
    assert len(selected) == len(rows)
