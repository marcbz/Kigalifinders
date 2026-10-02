"""Stable "typical asking rent" estimator for public research.

Plain medians over a small, lumpy sample jump whenever one listing is added or
edited, and KigaliRent verified inventory skews premium. The estimator:

1. Source-balancing — verified listings are capped at ``VERIFIED_MAX_SHARE`` of the
   total weight so premium inventory cannot define the whole market.
2. Robust centre — weighted mean of log prices winsorized at the weighted P20/P80.
   Every listing contributes a bounded amount (~1/N), so single edits nudge the
   figure instead of flipping it between neighbouring price points.
3. Benchmark anchoring — the centre is shrunk toward a trusted published reference
   (e.g. Wise cost-of-living data) with a fixed pseudo-sample weight. The data
   dominates as the sample grows; the anchor steadies thin slices.

Pure Python, O(n log n) per slice.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable

VERIFIED_MAX_SHARE = 0.3
WINSOR_LOW = 0.20
WINSOR_HIGH = 0.80
BENCHMARK_STRENGTH = 25.0
# Headline figures combine bedroom-level estimates with a fixed rental-stock mix, so
# a run of premium 4-5 bed houses changes the 4+ figure, not the whole market.
STANDARD_BEDROOM_MIX: dict[int, float] = {1: 0.35, 2: 0.35, 3: 0.20, 4: 0.10}
MIN_MIX_COVERAGE = 0.6


@dataclass(frozen=True)
class ReferenceBenchmark:
    source: str
    source_url: str
    label: str
    usd: float
    bedrooms: int | None
    area: str
    retrieved: date


# Wise cost-of-living, Kigali (USD), retrieved Sep 2026.
REFERENCE_BENCHMARKS: tuple[ReferenceBenchmark, ...] = (
    ReferenceBenchmark(
        "Wise", "https://wise.com/us/cost-of-living/rwanda/kigali",
        "Average rent per month in Kigali", 673.39, None, "kigali", date(2026, 9, 17),
    ),
    ReferenceBenchmark(
        "Wise", "https://wise.com/us/cost-of-living/rwanda/kigali",
        "1 bedroom apartment, city centre", 673.39, 1, "centre", date(2026, 9, 17),
    ),
    ReferenceBenchmark(
        "Wise", "https://wise.com/us/cost-of-living/rwanda/kigali",
        "1 bedroom apartment, outside centre", 420.88, 1, "outside", date(2026, 9, 17),
    ),
    ReferenceBenchmark(
        "Wise", "https://wise.com/us/cost-of-living/rwanda/kigali",
        "3 bedroom apartment, city centre", 1395.96, 3, "centre", date(2026, 9, 17),
    ),
    ReferenceBenchmark(
        "Wise", "https://wise.com/us/cost-of-living/rwanda/kigali",
        "3 bedroom apartment, outside centre", 860.06, 3, "outside", date(2026, 9, 17),
    ),
)


def _geo_mean(values: Iterable[float]) -> float | None:
    vals = [v for v in values if v and v > 0]
    if not vals:
        return None
    return math.exp(sum(math.log(v) for v in vals) / len(vals))


def benchmark_prior(bedrooms: int | None = None) -> float | None:
    """Reference typical rent for a Kigali-wide slice, or None when no benchmark applies.

    Bedroom priors blend city-centre and outside-centre references; 2-bed is
    log-interpolated between the 1- and 3-bed references. 4+ has no reference.
    """
    if bedrooms is None:
        return _geo_mean(b.usd for b in REFERENCE_BENCHMARKS if b.bedrooms is None)
    one = _geo_mean(b.usd for b in REFERENCE_BENCHMARKS if b.bedrooms == 1)
    three = _geo_mean(b.usd for b in REFERENCE_BENCHMARKS if b.bedrooms == 3)
    if bedrooms == 1:
        return one
    if bedrooms == 3:
        return three
    if bedrooms == 2 and one and three:
        return math.sqrt(one * three)
    return None


def benchmark_sources() -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    for b in REFERENCE_BENCHMARKS:
        entry = seen.setdefault(
            b.source,
            {
                "name": b.source,
                "source_key": f"benchmark:{b.source.lower()}",
                "source_url": b.source_url,
                "kind": "reference_benchmark",
                "retrieved": b.retrieved.isoformat(),
                "figures": [],
            },
        )
        entry["figures"].append({"label": b.label, "usd": b.usd, "bedrooms": b.bedrooms})
    return list(seen.values())


def _row_weights(rows: list[dict[str, Any]]) -> list[float]:
    n_verified = sum(1 for r in rows if r.get("origin") == "verified")
    n_other = len(rows) - n_verified
    if n_verified == 0 or n_other == 0:
        return [1.0] * len(rows)
    max_verified_total = VERIFIED_MAX_SHARE / (1 - VERIFIED_MAX_SHARE) * n_other
    w_verified = min(1.0, max_verified_total / n_verified)
    return [w_verified if r.get("origin") == "verified" else 1.0 for r in rows]


def weighted_quantile(pairs: list[tuple[float, float]], q: float) -> float:
    """Interpolated weighted quantile over (value, weight) pairs sorted by value."""
    if len(pairs) == 1:
        return pairs[0][0]
    total = sum(w for _, w in pairs)
    positions: list[float] = []
    acc = 0.0
    for _, w in pairs:
        positions.append((acc + w / 2) / total)
        acc += w
    if q <= positions[0]:
        return pairs[0][0]
    if q >= positions[-1]:
        return pairs[-1][0]
    for i in range(1, len(pairs)):
        if positions[i] >= q:
            lo_p, hi_p = positions[i - 1], positions[i]
            frac = (q - lo_p) / (hi_p - lo_p) if hi_p > lo_p else 0.0
            return pairs[i - 1][0] + frac * (pairs[i][0] - pairs[i - 1][0])
    return pairs[-1][0]


def estimate_typical_rent(
    rows: list[dict[str, Any]],
    *,
    prior_usd: float | None = None,
    min_sample: int = 3,
) -> dict[str, Any] | None:
    """Stable typical asking rent for a slice of combined market rows."""
    usable = [r for r in rows if r.get("usd") and float(r["usd"]) > 0]
    if len(usable) < min_sample:
        return None
    weights = _row_weights(usable)
    pairs = sorted(
        ((math.log(float(r["usd"])), w) for r, w in zip(usable, weights)),
        key=lambda p: p[0],
    )
    total_w = sum(w for _, w in pairs)
    lo = weighted_quantile(pairs, WINSOR_LOW)
    hi = weighted_quantile(pairs, WINSOR_HIGH)
    sample_centre = sum(min(max(v, lo), hi) * w for v, w in pairs) / total_w
    effective_n = total_w**2 / sum(w * w for _, w in pairs)

    centre = sample_centre
    anchored = prior_usd is not None and prior_usd > 0
    if anchored:
        centre = (effective_n * sample_centre + BENCHMARK_STRENGTH * math.log(prior_usd)) / (
            effective_n + BENCHMARK_STRENGTH
        )

    prices = [math.exp(v) for v, _ in pairs]
    verified_weight = next(
        (w for r, w in zip(usable, weights) if r.get("origin") == "verified"), None
    )
    return {
        "sample_size": len(usable),
        "raw_count": len(rows),
        "outliers_removed": 0,
        "median_usd": round(math.exp(centre), 2),
        "sample_centre_usd": round(math.exp(sample_centre), 2),
        "p25_usd": round(math.exp(weighted_quantile(pairs, 0.25)), 2),
        "p75_usd": round(math.exp(weighted_quantile(pairs, 0.75)), 2),
        "min_usd": round(min(prices), 2),
        "max_usd": round(max(prices), 2),
        "effective_sample": round(effective_n, 1),
        "verified_row_weight": round(verified_weight, 3) if verified_weight is not None else None,
        "benchmark_usd": round(prior_usd, 2) if anchored else None,
        "benchmark_weight": round(BENCHMARK_STRENGTH / (effective_n + BENCHMARK_STRENGTH), 3) if anchored else 0.0,
        "method": "robust_pooled",
    }


def _bedroom_bucket(row: dict[str, Any]) -> int | None:
    beds = row.get("bedrooms")
    if beds is None:
        return None
    try:
        beds = int(beds)
    except (TypeError, ValueError):
        return None
    if beds < 1:
        return None
    return min(beds, 4)


def estimate_market_rent(
    rows: list[dict[str, Any]],
    *,
    use_benchmarks: bool = True,
    min_sample: int = 3,
    prior_scale: float = 1.0,
) -> dict[str, Any] | None:
    """Headline typical rent: bedroom-level estimates combined with the standard mix.

    Falls back to the pooled estimate when too little of the mix has data.
    The P25/P75 range always describes the observed (weighted) asking rents.
    """
    def prior(beds: int | None) -> float | None:
        base = benchmark_prior(beds) if use_benchmarks else None
        return base * prior_scale if base else None

    pooled = estimate_typical_rent(rows, prior_usd=prior(None), min_sample=min_sample)
    if not pooled:
        return None

    components: dict[int, float] = {}
    for beds in STANDARD_BEDROOM_MIX:
        slice_rows = [r for r in rows if _bedroom_bucket(r) == beds]
        est = estimate_typical_rent(slice_rows, prior_usd=prior(beds), min_sample=min_sample)
        if est:
            components[beds] = est["median_usd"]

    coverage = sum(STANDARD_BEDROOM_MIX[b] for b in components)
    if coverage < MIN_MIX_COVERAGE:
        return pooled

    log_typical = sum(STANDARD_BEDROOM_MIX[b] * math.log(v) for b, v in components.items()) / coverage
    return {
        **pooled,
        "median_usd": round(math.exp(log_typical), 2),
        "pooled_usd": pooled["median_usd"],
        "method": "bedroom_mix_adjusted",
        "mix_coverage": round(coverage, 2),
        "bedroom_components": {("4+" if b == 4 else str(b)): v for b, v in sorted(components.items())},
    }
