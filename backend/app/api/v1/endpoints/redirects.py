"""Private redirect links for admin use (not indexed)."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Annotated, Any
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from slugify import slugify
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_admin
from app.database.session import get_db
from app.models import RedirectClick, RedirectLink, User
from app.schemas import (
    RedirectClickResponse,
    RedirectLinkCreate,
    RedirectLinkResponse,
    RedirectLinkUpdate,
    RedirectResolveResponse,
)

router = APIRouter(tags=["Redirects"])
admin_router = APIRouter(prefix="/admin/redirects", tags=["Admin Redirects"])

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _normalize_slug(raw: str) -> str:
    slug = slugify(raw.strip().lower(), max_length=80)
    if not slug or not _SLUG_RE.match(slug):
        raise HTTPException(status_code=400, detail="Slug must use letters, numbers, and hyphens only.")
    return slug


def _validate_destination(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Destination must be a valid http or https URL.")
    return url.strip()


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45] or None
    if request.client:
        return request.client.host[:45]
    return None


def _geo_from_request(request: Request) -> dict[str, str | None]:
    """Best-effort location from common edge/CDN headers (no external geo API)."""
    country = (
        request.headers.get("cf-ipcountry")
        or request.headers.get("x-vercel-ip-country")
        or request.headers.get("cloudfront-viewer-country")
    )
    city = request.headers.get("x-vercel-ip-city") or request.headers.get("cf-ipcity")
    region = request.headers.get("x-vercel-ip-country-region") or request.headers.get("cf-region")
    return {
        "country": (country or "").strip()[:80] or None,
        "city": (city or "").strip()[:120] or None,
        "region": (region or "").strip()[:120] or None,
    }


async def _record_click(db: AsyncSession, link: RedirectLink, request: Request) -> None:
    geo = _geo_from_request(request)
    db.add(
        RedirectClick(
            redirect_link_id=link.id,
            ip_address=_client_ip(request),
            country=geo["country"],
            region=geo["region"],
            city=geo["city"],
            user_agent=(request.headers.get("user-agent") or "")[:500] or None,
            referer=(request.headers.get("referer") or request.headers.get("referrer") or "")[:1000] or None,
            clicked_at=datetime.now(timezone.utc),
        )
    )
    link.clicks_count = int(link.clicks_count or 0) + 1
    link.updated_at = datetime.now(timezone.utc)
    await db.flush()


def _link_response(link: RedirectLink) -> RedirectLinkResponse:
    return RedirectLinkResponse.model_validate(link)


@router.get("/go/{slug}", response_model=RedirectResolveResponse)
async def resolve_redirect_json(
    slug: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Resolve slug and record click (used by Next.js /go route)."""
    slug = slug.strip().lower()
    result = await db.execute(select(RedirectLink).where(RedirectLink.slug == slug))
    link = result.scalar_one_or_none()
    if not link or not link.is_active:
        raise HTTPException(status_code=404, detail="Redirect not found")
    await _record_click(db, link, request)
    return RedirectResolveResponse(destination_url=link.destination_url)


@router.get("/go/{slug}/redirect", status_code=status.HTTP_302_FOUND)
async def resolve_redirect_direct(
    slug: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Direct API redirect (optional; primary path is frontend /go)."""
    payload = await resolve_redirect_json(slug, request, db)
    return RedirectResponse(url=payload.destination_url, status_code=302)


@admin_router.get("", response_model=list[RedirectLinkResponse])
async def list_redirects(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(RedirectLink).order_by(RedirectLink.created_at.desc()))
    return [_link_response(link) for link in result.scalars().all()]


@admin_router.post("", response_model=RedirectLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_redirect(
    data: RedirectLinkCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    slug = _normalize_slug(data.slug or data.title or "link")
    existing = await db.execute(select(RedirectLink.id).where(RedirectLink.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already in use")
    link = RedirectLink(
        slug=slug,
        destination_url=_validate_destination(data.destination_url),
        title=(data.title or "").strip() or None,
        notes=(data.notes or "").strip() or None,
        is_active=data.is_active if data.is_active is not None else True,
        created_by=user.id,
    )
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return _link_response(link)


@admin_router.get("/{link_id}", response_model=RedirectLinkResponse)
async def get_redirect(
    link_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    link = await _get_link_or_404(db, link_id)
    return _link_response(link)


@admin_router.patch("/{link_id}", response_model=RedirectLinkResponse)
async def update_redirect(
    link_id: UUID,
    data: RedirectLinkUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    link = await _get_link_or_404(db, link_id)
    if data.slug is not None:
        slug = _normalize_slug(data.slug)
        if slug != link.slug:
            taken = await db.execute(
                select(RedirectLink.id).where(RedirectLink.slug == slug, RedirectLink.id != link_id)
            )
            if taken.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Slug already in use")
            link.slug = slug
    if data.destination_url is not None:
        link.destination_url = _validate_destination(data.destination_url)
    if data.title is not None:
        link.title = data.title.strip() or None
    if data.notes is not None:
        link.notes = data.notes.strip() or None
    if data.is_active is not None:
        link.is_active = data.is_active
    link.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(link)
    return _link_response(link)


@admin_router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_redirect(
    link_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    link = await _get_link_or_404(db, link_id)
    await db.delete(link)


@admin_router.get("/{link_id}/clicks", response_model=list[RedirectClickResponse])
async def list_redirect_clicks(
    link_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
    limit: int = 50,
):
    await _get_link_or_404(db, link_id)
    limit = max(1, min(limit, 200))
    result = await db.execute(
        select(RedirectClick)
        .where(RedirectClick.redirect_link_id == link_id)
        .order_by(RedirectClick.clicked_at.desc())
        .limit(limit)
    )
    return [RedirectClickResponse.model_validate(c) for c in result.scalars().all()]


@admin_router.get("/{link_id}/stats")
async def redirect_stats(
    link_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
) -> dict[str, Any]:
    await _get_link_or_404(db, link_id)
    by_country = await db.execute(
        select(RedirectClick.country, func.count())
        .where(RedirectClick.redirect_link_id == link_id, RedirectClick.country.isnot(None))
        .group_by(RedirectClick.country)
        .order_by(func.count().desc())
        .limit(10)
    )
    return {
        "by_country": [{"country": row[0], "clicks": int(row[1])} for row in by_country.all()],
    }


async def _get_link_or_404(db: AsyncSession, link_id: UUID) -> RedirectLink:
    result = await db.execute(
        select(RedirectLink).options(selectinload(RedirectLink.clicks)).where(RedirectLink.id == link_id)
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Redirect not found")
    return link
