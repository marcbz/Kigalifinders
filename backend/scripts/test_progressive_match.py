"""Offline checks for progressive rental matching (no DB required)."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.landing_pages import generate_display_description
from app.services.search_intent import select_progressive_match_group


def _prop(
    *,
    pid: str,
    beds: int,
    price: float,
    neighborhood: str,
    ptype: str,
    published_days_ago: int,
    furnished: bool = False,
):
    published = datetime(2026, 8, 20, tzinfo=timezone.utc).replace(
        day=max(1, 20 - published_days_ago)
    )
    return SimpleNamespace(
        id=pid,
        bedrooms=beds,
        bathrooms=2,
        usd_price=price,
        price=price,
        currency="USD",
        is_furnished=furnished,
        listing_type=SimpleNamespace(value="rent"),
        published_at=published,
        created_at=published,
        neighborhood=SimpleNamespace(slug=neighborhood, name=neighborhood.title()),
        property_type=SimpleNamespace(slug=ptype, name=ptype.title()),
        amenities=[],
    )


def test_villa_kibagabaga_falls_back_without_emptying():
    """Villa type missing should not empty the page when beds+hood+budget exist."""
    query = {
        "location": "kibagabaga",
        "bedrooms": 2,
        "property_type": "villa",
        "max_price_usd": 2000,
    }
    props = [
        _prop(
            pid="house-new",
            beds=2,
            price=1800,
            neighborhood="kibagabaga",
            ptype="house",
            published_days_ago=1,
        ),
        _prop(
            pid="house-old",
            beds=2,
            price=1500,
            neighborhood="kibagabaga",
            ptype="house",
            published_days_ago=10,
        ),
        _prop(
            pid="villa-elsewhere",
            beds=2,
            price=1900,
            neighborhood="nyarutarama",
            ptype="villa",
            published_days_ago=0,
        ),
        _prop(
            pid="unrelated",
            beds=4,
            price=900,
            neighborhood="remera",
            ptype="apartment",
            published_days_ago=0,
        ),
    ]
    selected, mode, subset = select_progressive_match_group(props, query, limit=9)
    assert mode == "closest"
    assert "property_type" not in subset
    assert "bedrooms" in subset
    assert "location" in subset
    assert "budget" in subset
    ids = [p.id for p in selected]
    assert ids == ["house-new", "house-old"], ids
    assert "unrelated" not in ids
    assert "villa-elsewhere" not in ids


def test_exact_villa_preferred_when_present():
    query = {
        "location": "kibagabaga",
        "bedrooms": 2,
        "property_type": "villa",
        "max_price_usd": 2000,
    }
    props = [
        _prop(
            pid="villa-local",
            beds=2,
            price=1700,
            neighborhood="kibagabaga",
            ptype="villa",
            published_days_ago=5,
        ),
        _prop(
            pid="house-newer",
            beds=2,
            price=1600,
            neighborhood="kibagabaga",
            ptype="house",
            published_days_ago=0,
        ),
    ]
    selected, mode, subset = select_progressive_match_group(props, query, limit=9)
    assert mode == "exact"
    assert subset == frozenset({"bedrooms", "location", "budget", "property_type"})
    assert [p.id for p in selected] == ["villa-local"]


def test_descriptions_have_no_decorative_dashes():
    samples = [
        generate_display_description(
            {"bedrooms": 2, "property_type": "house", "max_price_usd": 1500, "location": "kigali"}
        ),
        generate_display_description(
            {"property_type": "apartment", "furnished": True, "location": "kigali"}
        ),
        generate_display_description({"location": "kibagabaga"}, location_name="Kibagabaga"),
    ]
    for text in samples:
        assert "—" not in text and "–" not in text, text
        assert " - " not in text, text
    assert samples[0] == (
        "Browse available 2 bedroom houses for rent in Kigali priced under $1,500 per month."
    )
    assert "move in ready" in samples[1]
    assert samples[2] == "Browse available houses and apartments for rent in Kibagabaga, Kigali."


if __name__ == "__main__":
    test_villa_kibagabaga_falls_back_without_emptying()
    test_exact_villa_preferred_when_present()
    test_descriptions_have_no_decorative_dashes()
    print("progressive match checks passed")
    for q, loc in [
        ({"bedrooms": 2, "property_type": "house", "max_price_usd": 1500, "location": "kigali"}, None),
        ({"property_type": "apartment", "furnished": True, "location": "kigali"}, None),
        ({"location": "kibagabaga"}, "Kibagabaga"),
    ]:
        print("-", generate_display_description(q, location_name=loc))
