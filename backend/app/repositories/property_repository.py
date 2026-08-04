from math import ceil
from typing import Optional, Sequence
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Amenity,
    Agent,
    District,
    Neighborhood,
    Property,
    PropertyImage,
    PropertyStatusEnum,
)
from app.schemas import PaginatedResponse, PropertyDetail, PropertyListItem, PropertySearchParams


class PropertyRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _base_query(self):
        return select(Property).options(
            selectinload(Property.district),
            selectinload(Property.neighborhood),
            selectinload(Property.property_type),
            selectinload(Property.images),
            selectinload(Property.amenities),
            selectinload(Property.agent).selectinload(Agent.user),
        )

    def _to_list_item(self, prop: Property) -> PropertyListItem:
        primary = next((img.url for img in prop.images if img.is_primary), None)
        if not primary and prop.images:
            primary = prop.images[0].url
        return PropertyListItem(
            id=prop.id,
            title=prop.title,
            slug=prop.slug,
            short_description=prop.short_description,
            listing_type=prop.listing_type.value,
            status=prop.status.value,
            price=prop.price,
            price_period=prop.price_period,
            currency=prop.currency,
            bedrooms=prop.bedrooms,
            bathrooms=prop.bathrooms,
            area_sqm=prop.area_sqm,
            lot_size_sqm=prop.lot_size_sqm,
            is_featured=prop.is_featured,
            is_premium=prop.is_premium,
            is_furnished=prop.is_furnished,
            has_title_deed=prop.has_title_deed,
            badge_label=prop.badge_label,
            district_name=prop.district.name if prop.district else None,
            neighborhood_name=prop.neighborhood.name if prop.neighborhood else None,
            property_type_name=prop.property_type.name if prop.property_type else None,
            property_type_ids=[str(x) for x in (prop.property_type_ids or [])],
            primary_image=primary,
            latitude=prop.latitude,
            longitude=prop.longitude,
            realtor_name=prop.realtor_name,
            has_balcony=prop.has_balcony,
            has_kitchen=prop.has_kitchen,
            has_pool=prop.has_pool,
            has_parking=prop.has_parking,
            has_jacuzzi=prop.has_jacuzzi,
            has_garden=prop.has_garden,
            pets_allowed=prop.pets_allowed,
        )

    def _to_detail(self, prop: Property) -> PropertyDetail:
        item = self._to_list_item(prop)
        agent_name = None
        agent_phone = None
        if prop.agent and prop.agent.user:
            agent_name = prop.agent.user.full_name
            agent_phone = prop.agent.user.phone
        return PropertyDetail(
            **item.model_dump(),
            description=prop.description,
            address=prop.address,
            year_built=prop.year_built,
            parking_spaces=prop.parking_spaces,
            floors=prop.floors,
            virtual_tour_url=prop.virtual_tour_url,
            floor_plan_url=prop.floor_plan_url,
            tour_360_url=prop.tour_360_url,
            views_count=prop.views_count,
            meta_title=prop.meta_title,
            meta_description=prop.meta_description,
            images=[img for img in prop.images],
            amenities=[a.name for a in prop.amenities],
            agent_name=agent_name,
            agent_phone=agent_phone,
            published_at=prop.published_at,
            created_at=prop.created_at,
        )

    async def search(self, params: PropertySearchParams, published_only: bool = True) -> PaginatedResponse[PropertyListItem]:
        query = self._base_query()

        if published_only:
            query = query.where(Property.status == PropertyStatusEnum.PUBLISHED)

        if params.q:
            term = f"%{params.q}%"
            query = query.where(
                or_(Property.title.ilike(term), Property.description.ilike(term), Property.address.ilike(term))
            )
        if params.listing_type:
            query = query.where(Property.listing_type == params.listing_type)
        if params.district_id:
            query = query.where(Property.district_id == params.district_id)
        if params.neighborhood_id:
            query = query.where(Property.neighborhood_id == params.neighborhood_id)
        if params.property_type_id:
            type_id = params.property_type_id
            type_id_str = str(type_id)
            query = query.where(
                or_(
                    Property.property_type_id == type_id,
                    Property.property_type_ids.contains([type_id_str]),
                )
            )
        if params.min_price is not None:
            query = query.where(Property.price >= params.min_price)
        if params.max_price is not None:
            query = query.where(Property.price <= params.max_price)
        if params.bedrooms is not None:
            query = query.where(Property.bedrooms >= params.bedrooms)
        if params.bathrooms is not None:
            query = query.where(Property.bathrooms >= params.bathrooms)
        if params.is_featured is not None:
            query = query.where(Property.is_featured == params.is_featured)
        if params.is_furnished is not None:
            query = query.where(Property.is_furnished == params.is_furnished)

        sort_col = getattr(Property, params.sort_by, Property.created_at)
        query = query.order_by(sort_col.desc() if params.sort_order == "desc" else sort_col.asc())

        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        offset = (params.page - 1) * params.page_size
        result = await self.db.execute(query.offset(offset).limit(params.page_size))
        items = [self._to_list_item(p) for p in result.scalars().all()]

        return PaginatedResponse(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            pages=ceil(total / params.page_size) if params.page_size else 0,
        )

    async def get_by_slug(self, slug: str) -> Optional[PropertyDetail]:
        result = await self.db.execute(self._base_query().where(Property.slug == slug))
        prop = result.scalar_one_or_none()
        if not prop:
            return None
        prop.views_count += 1
        await self.db.flush()
        return self._to_detail(prop)

    async def get_by_id(self, property_id: UUID) -> Optional[Property]:
        result = await self.db.execute(self._base_query().where(Property.id == property_id))
        return result.scalar_one_or_none()

    async def get_featured(self, limit: int = 6, listing_type: Optional[str] = None) -> Sequence[PropertyListItem]:
        query = (
            self._base_query()
            .where(Property.status == PropertyStatusEnum.PUBLISHED, Property.is_featured == True)
            .order_by(Property.created_at.desc())
            .limit(limit)
        )
        if listing_type:
            query = query.where(Property.listing_type == listing_type)
        result = await self.db.execute(query)
        return [self._to_list_item(p) for p in result.scalars().all()]

    async def get_related(self, prop: Property, limit: int = 4) -> Sequence[PropertyListItem]:
        conditions = [Property.district_id == prop.district_id]
        if prop.property_type_id:
            conditions.append(Property.property_type_id == prop.property_type_id)
            conditions.append(Property.property_type_ids.contains([str(prop.property_type_id)]))
        query = (
            self._base_query()
            .where(
                Property.status == PropertyStatusEnum.PUBLISHED,
                Property.id != prop.id,
                or_(*conditions),
            )
            .limit(limit)
        )
        result = await self.db.execute(query)
        return [self._to_list_item(p) for p in result.scalars().all()]
