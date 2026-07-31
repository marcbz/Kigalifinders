from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from slugify import slugify
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin, require_staff
from app.database.session import get_db
from app.models import Property, PropertyImage, PropertyStatusEnum, User
from app.repositories.property_repository import PropertyRepository
from app.schemas import PaginatedResponse, PropertyCreate, PropertyDetail, PropertyImageInput, PropertyListItem, PropertySearchParams, PropertyUpdate

router = APIRouter(prefix="/properties", tags=["Properties"])


async def _sync_property_images(db: AsyncSession, prop: Property, images: list[PropertyImageInput] | None) -> None:
    if images is None:
        return
    for img in list(prop.images):
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
    property_type_id: Optional[UUID] = None,
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
        property_type_id=property_type_id, min_price=min_price, max_price=max_price,
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
    prop = await repo.get_by_slug(slug)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


@router.get("/{slug}/related", response_model=list[PropertyListItem])
async def related_properties(slug: str, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = PropertyRepository(db)
    prop = await repo.get_by_slug(slug)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    db_prop = await repo.get_by_id(prop.id)
    return await repo.get_related(db_prop)


@router.post("", response_model=PropertyListItem, status_code=status.HTTP_201_CREATED)
async def create_property(
    data: PropertyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_staff)],
):
    from app.models import ListingType

    prop = Property(
        title=data.title,
        slug=data.slug or slugify(data.title),
        description=data.description,
        short_description=data.short_description,
        listing_type=ListingType(data.listing_type),
        status=PropertyStatusEnum(data.status),
        price=data.price,
        price_period=data.price_period,
        currency=data.currency,
        bedrooms=data.bedrooms,
        bathrooms=data.bathrooms,
        area_sqm=data.area_sqm,
        lot_size_sqm=data.lot_size_sqm,
        district_id=data.district_id,
        neighborhood_id=data.neighborhood_id,
        property_type_id=data.property_type_id,
        agent_id=data.agent_id,
        is_featured=data.is_featured,
        is_premium=data.is_premium,
        is_furnished=data.is_furnished,
        has_title_deed=data.has_title_deed,
        badge_label=data.badge_label,
        address=data.address,
        latitude=data.latitude,
        longitude=data.longitude,
    )
    db.add(prop)
    await db.flush()
    await _sync_property_images(db, prop, data.images)
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
    images = updates.pop("images", None)
    if "listing_type" in updates:
        updates["listing_type"] = ListingType(updates["listing_type"])
    if "status" in updates:
        updates["status"] = PropertyStatusEnum(updates["status"])
    if "title" in updates and "slug" not in updates:
        updates["slug"] = slugify(updates["title"])

    for field, value in updates.items():
        setattr(prop, field, value)

    await db.flush()
    if images is not None:
        await _sync_property_images(db, prop, images)
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
