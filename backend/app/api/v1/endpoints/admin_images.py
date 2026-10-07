"""Admin endpoints for watermarking listing photos (new uploads, pasted URLs, existing photos)."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin, require_staff
from app.database.session import AsyncSessionLocal, get_db
from app.models import ImageWatermark, PropertyImage, User
from app.services import watermark as wm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/images", tags=["Admin"])

DbSession = Annotated[AsyncSession, Depends(get_db)]


class WatermarkUrlBody(BaseModel):
    url: str = Field(min_length=8, max_length=1000)


class WatermarkExistingBody(BaseModel):
    property_id: UUID | None = None


_job: dict[str, Any] = {"running": False}
_job_lock = asyncio.Lock()
_task: asyncio.Task | None = None


def _unwatermarked_images():
    return (
        select(PropertyImage.id, PropertyImage.url)
        .outerjoin(ImageWatermark, ImageWatermark.url == PropertyImage.url)
        .where(ImageWatermark.id.is_(None), PropertyImage.url != "")
    )


@router.post("/watermark")
async def watermark_image_url(body: WatermarkUrlBody, db: DbSession, user: Annotated[User, Depends(require_staff)]):
    """Watermark a pasted image URL; returns the URL to save on the listing (unchanged if already watermarked)."""
    try:
        url, already = await wm.watermark_url(db, body.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return {"url": url, "already_watermarked": already}


@router.get("/watermark/status")
async def watermark_status(db: DbSession, user: Annotated[User, Depends(require_admin)]):
    total = (await db.execute(select(func.count(PropertyImage.id)).where(PropertyImage.url != ""))).scalar_one()
    pending = (await db.execute(select(func.count()).select_from(_unwatermarked_images().subquery()))).scalar_one()
    return {
        "total": total,
        "watermarked": total - pending,
        "pending": pending,
        "storage_configured": wm.storage_configured(),
        "job": {k: v for k, v in _job.items()},
    }


async def _run_existing_job(property_id: UUID | None) -> None:
    try:
        async with AsyncSessionLocal() as db:
            stmt = _unwatermarked_images()
            if property_id:
                stmt = stmt.where(PropertyImage.property_id == property_id)
            rows = (await db.execute(stmt.order_by(PropertyImage.created_at))).all()
            _job["total"] = len(rows)
            # Same photo can be reused across images; watermark each source URL once.
            done_urls: dict[str, str] = {}
            for image_id, url in rows:
                try:
                    new_url = done_urls.get(url)
                    if new_url is None:
                        new_url, _ = await wm.watermark_url(db, url)
                    img = await db.get(PropertyImage, image_id)
                    if img is not None and img.url == url:
                        img.url = new_url
                    await db.commit()
                    done_urls[url] = new_url
                    _job["done"] += 1
                except Exception as exc:  # keep going; report the last error
                    await db.rollback()
                    _job["failed"] += 1
                    _job["last_error"] = f"{url[:120]}: {exc}"[:400]
                    logger.warning("Watermark failed for image %s: %s", image_id, exc)
    except Exception as exc:
        _job["last_error"] = str(exc)[:400]
        logger.exception("Watermark job crashed")
    finally:
        _job["running"] = False
        _job["finished_at"] = datetime.now(timezone.utc).isoformat()


@router.post("/watermark/existing", status_code=202)
async def watermark_existing(body: WatermarkExistingBody, user: Annotated[User, Depends(require_admin)]):
    """Start watermarking existing listing photos (all listings, or one) in the background."""
    if not wm.storage_configured():
        raise HTTPException(status_code=400, detail="Image storage is not configured on the server.")
    async with _job_lock:
        if _job.get("running"):
            raise HTTPException(status_code=409, detail="Watermarking is already running. Check progress below.")
        _job.clear()
        _job.update(
            running=True, done=0, failed=0, total=None, last_error=None,
            property_id=str(body.property_id) if body.property_id else None,
            started_at=datetime.now(timezone.utc).isoformat(), finished_at=None,
        )
    global _task
    _task = asyncio.create_task(_run_existing_job(body.property_id))
    return {"started": True}
