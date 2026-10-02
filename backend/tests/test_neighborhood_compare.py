from datetime import datetime, timezone

from app.services.neighborhood_compare import (
    MIN_COMPARE_SAMPLE,
    build_comparison,
    build_profile,
    canonical_pair_slug,
    eligible_slugs,
    parse_pair_slug,
)

NOW = datetime.now(timezone.utc)


def _rows(slug, name, prices, *, bedrooms=2, furnished=False, origin="external"):
    return [
        {
            "usd": float(p),
            "bedrooms": bedrooms,
            "is_furnished": furnished,
            "property_type": "apartment",
            "location_slug": slug,
            "location_name": name,
            "observed_at": NOW,
            "origin": origin,
            "dedupe": f"{slug}:{i}:{p}:{bedrooms}:{furnished}",
        }
        for i, p in enumerate(prices)
    ]


def _market():
    cheap = _rows("kagarama", "Kagarama", [500, 550, 600, 620, 650, 700, 720, 750, 800, 820])
    pricey = _rows("nyarutarama", "Nyarutarama", [1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500], furnished=True)
    thin = _rows("gisozi", "Gisozi", [600, 700, 800])
    return cheap + pricey + thin


def test_pair_slug_is_canonical_and_parseable():
    assert canonical_pair_slug("Nyarutarama", "kagarama") == "kagarama-vs-nyarutarama"
    assert parse_pair_slug("nyarutarama-vs-kagarama") == ("nyarutarama", "kagarama")
    assert parse_pair_slug("kagarama-vs-kagarama") is None
    assert parse_pair_slug("kagarama") is None


def test_thin_neighborhoods_are_not_eligible():
    rows = _market()
    slugs = eligible_slugs(rows)
    assert set(slugs) == {"kagarama", "nyarutarama"}
    assert build_profile(rows, "gisozi") is None
    assert MIN_COMPARE_SAMPLE > 3


def test_comparison_names_the_cheaper_area_and_bedroom_rows():
    rows = _market()
    a = build_profile(rows, "kagarama", [{"has_pool": False, "has_garden": True, "has_parking": True}])
    b = build_profile(rows, "nyarutarama", [{"has_pool": True, "has_garden": True, "has_parking": True}])
    result = build_comparison(a, b)

    assert result["slug"] == "kagarama-vs-nyarutarama"
    assert result["cheaper_slug"] == "kagarama"
    assert result["price_difference_pct"] > 50
    assert result["summary"][0].startswith("Kagarama is about")
    assert result["bedroom_rows"][0]["label"] == "2 bedrooms"
    assert a["amenities"]["pool_pct"] == 0 and b["amenities"]["pool_pct"] == 100
    assert b["furnished_share_pct"] == 100
    assert any("Furnished homes are more common in Nyarutarama" in s for s in result["summary"])
    assert len(result["faqs"]) == 3


def test_similar_prices_are_not_called_cheaper():
    rows = _rows("remera", "Remera", [700, 720, 740, 760, 780, 800, 820, 840]) + _rows(
        "kimironko", "Kimironko", [710, 730, 750, 770, 790, 810, 830, 850]
    )
    result = build_comparison(build_profile(rows, "kimironko"), build_profile(rows, "remera"))
    assert result["cheaper_slug"] is None
    assert "similarly priced" in result["summary"][0]
