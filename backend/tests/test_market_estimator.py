"""Stability guarantees for the public typical-rent estimator."""

import math
import random

import pytest

from app.services.market_estimator import (
    BENCHMARK_STRENGTH,
    VERIFIED_MAX_SHARE,
    benchmark_prior,
    benchmark_sources,
    estimate_market_rent,
    estimate_typical_rent,
    weighted_quantile,
)


def _row(usd, bedrooms=2, origin="external"):
    return {"usd": usd, "bedrooms": bedrooms, "origin": origin}


def _market(seed=7):
    rng = random.Random(seed)
    rows = []
    for beds, n, centre in [(1, 30, 480), (2, 40, 650), (3, 25, 1000), (4, 20, 1400)]:
        rows += [_row(round(math.exp(rng.gauss(math.log(centre), 0.3))), beds) for _ in range(n)]
    for beds, n, centre in [(2, 15, 1000), (3, 25, 1300), (4, 40, 1500)]:
        rows += [_row(round(math.exp(rng.gauss(math.log(centre), 0.25))), beds, "verified") for _ in range(n)]
    return rows


def test_benchmark_priors_follow_wise_references():
    assert benchmark_prior(None) == pytest.approx(673.39)
    one, two, three = benchmark_prior(1), benchmark_prior(2), benchmark_prior(3)
    assert one == pytest.approx(math.sqrt(673.39 * 420.88))
    assert three == pytest.approx(math.sqrt(1395.96 * 860.06))
    assert one < two < three
    assert benchmark_prior(4) is None
    assert benchmark_sources()[0]["source_url"].startswith("https://wise.com/")


def test_weighted_quantile_matches_unweighted_median():
    pairs = [(v, 1.0) for v in (1.0, 2.0, 3.0, 4.0, 5.0)]
    assert weighted_quantile(pairs, 0.5) == pytest.approx(3.0)


def test_verified_inventory_is_capped():
    rows = [_row(2000, origin="verified") for _ in range(100)] + [_row(500) for _ in range(50)]
    est = estimate_typical_rent(rows)
    verified_total = est["verified_row_weight"] * 100
    assert verified_total / (verified_total + 50) == pytest.approx(VERIFIED_MAX_SHARE, abs=1e-3)
    # A plain median would be $2,000; balancing keeps the external market in charge.
    assert est["median_usd"] < 1000


def test_single_listing_moves_estimate_by_a_bounded_amount():
    rows = _market()
    base = estimate_typical_rent(rows)["median_usd"]
    for extreme in (50, 10_000):
        moved = estimate_typical_rent(rows + [_row(extreme)])["median_usd"]
        assert abs(moved - base) / base < 0.01


def test_premium_publishes_barely_move_the_headline():
    rows = _market()
    base = estimate_market_rent(rows)["median_usd"]
    step_max = 0.0
    prev = base
    for k in range(30):
        rows.append(_row(1500 + (k % 3) * 200, 4 + (k % 2), "verified"))
        cur = estimate_market_rent(rows)["median_usd"]
        step_max = max(step_max, abs(cur - prev) / prev)
        prev = cur
    assert step_max < 0.005
    assert abs(prev - base) / base < 0.03


def test_headline_uses_bedroom_mix_and_anchor():
    est = estimate_market_rent(_market())
    assert est["method"] == "bedroom_mix_adjusted"
    assert set(est["bedroom_components"]) == {"1", "2", "3", "4+"}
    assert est["median_usd"] < est["pooled_usd"]


def test_anchor_weight_shrinks_as_sample_grows():
    small = estimate_typical_rent([_row(900) for _ in range(5)], prior_usd=673.39)
    large = estimate_typical_rent([_row(900) for _ in range(500)], prior_usd=673.39)
    assert small["benchmark_weight"] == pytest.approx(BENCHMARK_STRENGTH / (5 + BENCHMARK_STRENGTH), abs=1e-3)
    assert 673.39 < small["median_usd"] < large["median_usd"] < 900


def test_falls_back_to_pooled_and_respects_min_sample():
    only_one_bed = [_row(500 + i, 1) for i in range(10)]
    assert estimate_market_rent(only_one_bed)["method"] == "robust_pooled"
    assert estimate_typical_rent([_row(500), _row(600)]) is None
