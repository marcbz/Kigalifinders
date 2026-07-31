from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.models import Agent

router = APIRouter(prefix="/agents", tags=["Agents"])


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bio: str | None = None
    years_experience: int
    specializations: list | None = None
    whatsapp: str | None = None
    is_featured: bool
    rating: float
    review_count: int
    properties_sold: int
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


@router.get("", response_model=list[AgentResponse])
async def list_agents(db: Annotated[AsyncSession, Depends(get_db)], featured_only: bool = False):
    query = (
        select(Agent)
        .options(selectinload(Agent.user))
        .where(Agent.is_active == True)
        .order_by(Agent.rating.desc())
    )
    if featured_only:
        query = query.where(Agent.is_featured == True)
    result = await db.execute(query)
    agents = []
    for a in result.scalars().all():
        agents.append(
            AgentResponse(
                id=a.id,
                bio=a.bio,
                years_experience=a.years_experience,
                specializations=a.specializations,
                whatsapp=a.whatsapp,
                is_featured=a.is_featured,
                rating=a.rating,
                review_count=a.review_count,
                properties_sold=a.properties_sold,
                name=a.user.full_name if a.user else None,
                email=a.user.email if a.user else None,
                phone=a.user.phone if a.user else None,
                avatar_url=a.user.avatar_url if a.user else None,
            )
        )
    return agents


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Agent).options(selectinload(Agent.user)).where(Agent.id == agent_id)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentResponse(
        id=a.id,
        bio=a.bio,
        years_experience=a.years_experience,
        specializations=a.specializations,
        whatsapp=a.whatsapp,
        is_featured=a.is_featured,
        rating=a.rating,
        review_count=a.review_count,
        properties_sold=a.properties_sold,
        name=a.user.full_name if a.user else None,
        email=a.user.email if a.user else None,
        phone=a.user.phone if a.user else None,
        avatar_url=a.user.avatar_url if a.user else None,
    )
