"""Private admin notes must stay off public property serializers."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from app.models import ListingType, PropertyStatusEnum
from app.repositories.property_repository import PropertyRepository
from app.schemas import AdminPropertyDetail, PropertyDetail, PropertyListItem


class _FakeRepo(PropertyRepository):
    def __init__(self):
        self.db = None  # type: ignore[assignment]


def _fake_prop(**overrides):
    district_id = uuid4()
    neighborhood_id = uuid4()
    base = dict(
        id=uuid4(),
        title="Quiet Flat",
        slug="quiet-flat",
        short_description="Nice place",
        listing_type=ListingType.RENT,
        status=PropertyStatusEnum.PUBLISHED,
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
        property_type=SimpleNamespace(name="Apartment"),
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
        updated_at=None,
        usd_price=900,
        original_price=None,
        original_currency=None,
        last_verified_at=None,
        data_source_kind="verified_kigali_rent",
        description="Full description here",
        address="KG 123 St, behind the bakery, ask the guard",
        crm_notes="Landlord: Jean +2507… / Commissioner: Marie WhatsApp …",
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
        in_crm=False,
        availability_status="AVAILABLE",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_public_detail_excludes_crm_notes_field():
    assert "crm_notes" not in PropertyDetail.model_fields
    assert "crm_notes" not in PropertyListItem.model_fields
    assert "crm_notes" in AdminPropertyDetail.model_fields


def test_admin_detail_includes_private_notes_and_address():
    repo = _FakeRepo()
    prop = _fake_prop()
    detail = repo._to_detail(prop)  # type: ignore[arg-type]
    admin = repo._to_admin_detail(prop)  # type: ignore[arg-type]

    assert detail.address == prop.address
    assert not hasattr(detail, "crm_notes") or "crm_notes" not in detail.model_dump()

    assert admin.address == prop.address
    assert admin.crm_notes == prop.crm_notes
    assert "crm_notes" in admin.model_dump()


def test_public_slug_response_strips_address():
    repo = _FakeRepo()
    prop = _fake_prop()
    detail = repo._to_detail(prop)  # type: ignore[arg-type]
    public = detail.model_copy(update={"address": None})
    dumped = public.model_dump()
    assert dumped["address"] is None
    assert "crm_notes" not in dumped
