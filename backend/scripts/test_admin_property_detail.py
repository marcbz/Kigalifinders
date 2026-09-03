"""Offline checks for admin property detail / draft edit hydration helpers."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from app.models import ListingType, PropertyStatusEnum
from app.repositories.property_repository import PropertyRepository


class _FakeRepo(PropertyRepository):
    def __init__(self):
        # Bypass DB session — we only exercise serializer helpers.
        self.db = None  # type: ignore[assignment]


def test_list_item_includes_location_ids():
    district_id = uuid4()
    neighborhood_id = uuid4()
    prop = SimpleNamespace(
        id=uuid4(),
        title="Draft House",
        slug="draft-house",
        short_description="Nice place",
        listing_type=ListingType.RENT,
        status=PropertyStatusEnum.DRAFT,
        price=900,
        previous_price=None,
        price_period="month",
        currency="USD",
        bedrooms=2,
        bathrooms=1,
        area_sqm=80,
        lot_size_sqm=None,
        is_featured=False,
        is_premium=False,
        is_furnished=True,
        has_title_deed=False,
        badge_label=None,
        district_id=district_id,
        neighborhood_id=neighborhood_id,
        district=SimpleNamespace(name="Gasabo"),
        neighborhood=SimpleNamespace(name="Gacuriro"),
        property_type=SimpleNamespace(name="House"),
        property_type_ids=[str(uuid4())],
        images=[],
        latitude=None,
        longitude=None,
        realtor_name="Ada",
        has_balcony=False,
        has_kitchen=True,
        has_pool=False,
        has_parking=True,
        has_jacuzzi=False,
        has_garden=False,
        pets_allowed=False,
        show_features_table=True,
        views_count=0,
        published_at=None,
        created_at=None,
        usd_price=900,
        original_price=None,
        original_currency=None,
        last_verified_at=None,
        data_source_kind="verified_kigali_rent",
        description="Full description here",
        address=None,
        year_built=None,
        parking_spaces=None,
        floors=None,
        virtual_tour_url=None,
        floor_plan_url=None,
        tour_360_url=None,
        meta_title="Meta",
        meta_description="Desc",
        amenities=[],
        agent=None,
        exchange_rate=None,
        exchange_rate_date=None,
        exchange_rate_source=None,
    )
    repo = _FakeRepo()
    item = repo._to_list_item(prop)  # type: ignore[arg-type]
    assert item.district_id == district_id
    assert item.neighborhood_id == neighborhood_id
    assert item.status == "draft"

    detail = repo._to_detail(prop)  # type: ignore[arg-type]
    assert detail.description == "Full description here"
    assert detail.district_id == district_id
    assert detail.meta_title == "Meta"
    print("admin property detail serialization ok")


if __name__ == "__main__":
    test_list_item_includes_location_ids()
