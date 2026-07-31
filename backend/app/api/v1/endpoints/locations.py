from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.models import District, Neighborhood, PropertyType
from app.schemas import DistrictResponse, NeighborhoodResponse, PropertyTypeResponse

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/districts", response_model=list[DistrictResponse])
async def list_districts(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(District).where(District.is_active == True).order_by(District.property_count.desc())
    )
    return [DistrictResponse.model_validate(d) for d in result.scalars().all()]


@router.get("/property-types", response_model=list[PropertyTypeResponse])
async def list_property_types(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(PropertyType).where(PropertyType.is_active == True).order_by(PropertyType.name)
    )
    return [PropertyTypeResponse.model_validate(pt) for pt in result.scalars().all()]


@router.get("/neighborhoods", response_model=list[NeighborhoodResponse])
async def list_neighborhoods(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Neighborhood)
        .options(selectinload(Neighborhood.district))
        .where(Neighborhood.is_active == True)
        .order_by(Neighborhood.property_count.desc())
    )
    return [
        NeighborhoodResponse(
            id=n.id,
            name=n.name,
            slug=n.slug,
            image_url=n.image_url,
            property_count=n.property_count,
            district_name=n.district.name if n.district else None,
        )
        for n in result.scalars().all()
    ]
