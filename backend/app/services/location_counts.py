from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import District, Neighborhood, Property, PropertyStatusEnum


async def sync_location_counts(db: AsyncSession) -> None:
    """Refresh district and neighborhood property_count from published listings."""
    published = Property.status == PropertyStatusEnum.PUBLISHED

    neighborhood_counts = await db.execute(
        select(Property.neighborhood_id, func.count())
        .where(published, Property.neighborhood_id.isnot(None))
        .group_by(Property.neighborhood_id)
    )
    neighborhood_map = {nid: count for nid, count in neighborhood_counts.all()}

    district_counts = await db.execute(
        select(Property.district_id, func.count())
        .where(published, Property.district_id.isnot(None))
        .group_by(Property.district_id)
    )
    district_map = {did: count for did, count in district_counts.all()}

    neighborhoods = (await db.execute(select(Neighborhood))).scalars().all()
    for neighborhood in neighborhoods:
        neighborhood.property_count = neighborhood_map.get(neighborhood.id, 0)

    districts = (await db.execute(select(District))).scalars().all()
    for district in districts:
        district.property_count = district_map.get(district.id, 0)

    await db.flush()
