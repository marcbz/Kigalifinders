from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin, require_staff
from app.database.session import get_db
from app.models import Property, PropertyImage, PropertyStatusEnum, User
from app.services.location_counts import sync_location_counts
from app.repositories.property_repository import PropertyRepository
from app.schemas import PaginatedResponse, PropertyCreate, PropertyDetail, PropertyImageInput, PropertyListItem, PropertySearchParams, PropertyUpdate

router = APIRouter(prefix="/properties", tags=["Properties"])


def _normalize_images(images: list[Any] | None) -> list[PropertyImageInput] | None:
    if images is None:
        return None
    return [img if isinstance(img, PropertyImageInput) else PropertyImageInput(**img) for img in images]


async def _unique_slug(db: AsyncSession, base_slug: str, exclude_id: UUID | None = None) -> str:
    slug = base_slug
    counter = 1
    while True:
        query = select(Property.id).where(Property.slug == slug)
        if exclude_id:
            query = query.where(Property.id != exclude_id)
        existing = await db.execute(query)
        if existing.scalar_one_or_none() is None:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def _resolve_property_types(
    property_type_id: UUID | None,
    property_type_ids: list[str] | None,
) -> tuple[UUID | None, list[str]]:
    ids = [str(x) for x in property_type_ids or []]
    primary = property_type_id
    if primary:
        pid = str(primary)
        if pid not in ids:
            ids = [pid, *ids]
    elif ids:
        primary = UUID(ids[0])
    return primary, ids


async def _sync_property_images(db: AsyncSession, prop: Property, images: list[PropertyImageInput] | None) -> None:
    if images is None:
        return
    result = await db.execute(select(PropertyImage).where(PropertyImage.property_id == prop.id))
    for img in result.scalars().all():
        await db.delete(img)
    await db.flush()
    for i, img in enumerate(images):
        if not img.url.strip():
            continue
        db.add(
            PropertyImage(
                property_id=prop.id,
                url=img.url.strip(),
                alt_text=img.alt_text,
                is_primary=img.is_primary,
                sort_order=img.sort_order if img.sort_order else i,
            )
        )


def _search_params(
    q: Optional[str] = None,
    listing_type: Optional[str] = None,
    district_id: Optional[UUID] = None,
    neighborhood_id: Optional[UUID] = None,
    neighborhood_slug: Optional[str] = None,
    property_type_id: Optional[UUID] = None,
    property_type_slug: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    bedrooms: Optional[int] = None,
    bathrooms: Optional[int] = None,
    is_featured: Optional[bool] = None,
    is_furnished: Optional[bool] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
) -> PropertySearchParams:
    return PropertySearchParams(
        q=q, listing_type=listing_type, district_id=district_id, neighborhood_id=neighborhood_id,
        neighborhood_slug=neighborhood_slug, property_type_id=property_type_id, property_type_slug=property_type_slug, min_price=min_price, max_price=max_price,
        bedrooms=bedrooms, bathrooms=bathrooms, is_featured=is_featured, is_furnished=is_furnished,
        sort_by=sort_by, sort_order=sort_order, page=page, page_size=page_size,
    )


@router.get("", response_model=PaginatedResponse[PropertyListItem])
async def list_properties(
    params: Annotated[PropertySearchParams, Depends(_search_params)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = PropertyRepository(db)
    return await repo.search(params)


@router.get("/manage", response_model=PaginatedResponse[PropertyListItem])
async def list_properties_admin(
    params: Annotated[PropertySearchParams, Depends(_search_params)],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_staff)],
):
    repo = PropertyRepository(db)
    return await repo.search(params, published_only=False)


@router.get("/featured", response_model=list[PropertyListItem])
async def featured_properties(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(6, ge=1, le=24),
    listing_type: Optional[str] = None,
):
    repo = PropertyRepository(db)
    return await repo.get_featured(limit=limit, listing_type=listing_type)


@router.get("/{slug}", response_model=PropertyDetail)
async def get_property(slug: str, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = PropertyRepository(db)
    prop = await repo.get_by_slug(slug, track_view=True, published_only=True)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


@router.get("/{slug}/related", response_model=PaginatedResponse[PropertyListItem])
async def related_properties(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=24),
):
    repo = PropertyRepository(db)
    prop = await repo.get_by_slug(slug, track_view=False, published_only=True)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    db_prop = await repo.get_by_id(prop.id)
    return await repo.get_related(db_prop, page=page, page_size=page_size)


@router.post("", response_model=PropertyListItem, status_code=status.HTTP_201_CREATED)
async def create_property(
    data: PropertyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_staff)],
):
    from app.models import ListingType

    slug = data.slug or slugify(data.title)
    slug = await _unique_slug(db, slug)
    status_enum = PropertyStatusEnum(data.status)
    published_at = datetime.now(timezone.utc) if status_enum == PropertyStatusEnum.PUBLISHED else None
    primary_type_id, type_ids = _resolve_property_types(data.property_type_id, data.property_type_ids)

    prop = Property(
        title=data.title,
        slug=slug,
        description=data.description,
        short_description=data.short_description,
        listing_type=ListingType(data.listing_type),
        status=status_enum,
        price=data.price,
        price_period=data.price_period or None,
        published_at=published_at,
        currency=data.currency,
        bedrooms=data.bedrooms,
        bathrooms=data.bathrooms,
        area_sqm=data.area_sqm,
        lot_size_sqm=data.lot_size_sqm,
        district_id=data.district_id,
        neighborhood_id=data.neighborhood_id,
        property_type_id=primary_type_id,
        property_type_ids=type_ids,
        agent_id=data.agent_id,
        is_featured=data.is_featured,
        is_premium=data.is_premium,
        is_furnished=data.is_furnished,
        has_title_deed=data.has_title_deed,
        badge_label=data.badge_label,
        address=data.address,
        latitude=data.latitude,
        longitude=data.longitude,
        realtor_name=data.realtor_name,
        has_balcony=data.has_balcony,
        has_kitchen=data.has_kitchen,
        has_pool=data.has_pool,
        has_parking=data.has_parking,
        has_jacuzzi=data.has_jacuzzi,
        has_garden=data.has_garden,
        pets_allowed=data.pets_allowed,
        show_features_table=data.show_features_table,
        meta_title=data.meta_title,
        meta_description=data.meta_description,
    )
    db.add(prop)
    await db.flush()
    await _sync_property_images(db, prop, data.images)
    await sync_location_counts(db)
    repo = PropertyRepository(db)
    result = await repo.get_by_id(prop.id)
    return repo._to_list_item(result)


@router.patch("/{property_id}", response_model=PropertyListItem)
async def update_property(
    property_id: UUID,
    data: PropertyUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_staff)],
):
    from app.models import ListingType

    repo = PropertyRepository(db)
    prop = await repo.get_by_id(property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    updates = data.model_dump(exclude_unset=True)
    images = _normalize_images(updates.pop("images", None))
    if "listing_type" in updates:
        updates["listing_type"] = ListingType(updates["listing_type"])
    if "status" in updates:
        status_enum = PropertyStatusEnum(updates["status"])
        updates["status"] = status_enum
        if status_enum == PropertyStatusEnum.PUBLISHED and not prop.published_at:
            updates["published_at"] = datetime.now(timezone.utc)
    if "title" in updates and "slug" not in updates:
        updates["slug"] = await _unique_slug(db, slugify(updates["title"]), exclude_id=property_id)
    if "slug" in updates:
        updates["slug"] = await _unique_slug(db, updates["slug"], exclude_id=property_id)
    if "price_period" in updates and not updates["price_period"]:
        updates["price_period"] = None
    if "property_type_ids" in updates or "property_type_id" in updates:
        primary_type_id, type_ids = _resolve_property_types(
            updates.get("property_type_id", prop.property_type_id),
            updates.get("property_type_ids", prop.property_type_ids),
        )
        updates["property_type_id"] = primary_type_id
        updates["property_type_ids"] = type_ids

    for field, value in updates.items():
        setattr(prop, field, value)

    await db.flush()
    if images is not None:
        await _sync_property_images(db, prop, images)
    await sync_location_counts(db)
    result = await repo.get_by_id(property_id)
    return repo._to_list_item(result)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    property_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    repo = PropertyRepository(db)
    prop = await repo.get_by_id(property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    await db.delete(prop)
    await sync_location_counts(db)
