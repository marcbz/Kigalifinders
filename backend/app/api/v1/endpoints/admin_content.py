from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.core.deps import require_admin, require_staff
from app.database.session import get_db
from app.models import BlogPost, ContactMessage, FAQ, Property, Setting, User, ViewingRequest
from app.schemas import (
    AdminBlogPostDetail,
    AdminBlogPostListItem,
    BlogPostCreate,
    BlogPostUpdate,
    ContactMessageResponse,
    FAQCreate,
    FAQResponse,
    FAQUpdate,
    SettingUpdate,
    UploadResponse,
    ViewingRequestResponse,
)
from app.services.media_upload import upload_image

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/messages", response_model=list[ContactMessageResponse])
async def list_contact_messages(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(ContactMessage).order_by(ContactMessage.created_at.desc()))
    return [ContactMessageResponse.model_validate(m) for m in result.scalars().all()]


@router.patch("/messages/{message_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_message_read(
    message_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(ContactMessage).where(ContactMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.is_read = True
    await db.flush()


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(ContactMessage).where(ContactMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    await db.delete(msg)


@router.get("/inquiries", response_model=list[ViewingRequestResponse])
async def list_inquiries(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(
        select(ViewingRequest, Property.title, Property.slug)
        .join(Property, ViewingRequest.property_id == Property.id)
        .order_by(ViewingRequest.created_at.desc())
    )
    return [
        ViewingRequestResponse(
            id=req.id,
            property_id=req.property_id,
            property_title=title,
            property_slug=slug,
            name=req.name,
            email=req.email,
            phone=req.phone,
            message=req.message,
            status=req.status,
            created_at=req.created_at,
        )
        for req, title in result.all()
    ]


@router.delete("/inquiries/{inquiry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inquiry(
    inquiry_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(ViewingRequest).where(ViewingRequest.id == inquiry_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    await db.delete(req)


@router.post("/upload", response_model=UploadResponse)
async def upload_media(
    user: Annotated[User, Depends(require_staff)],
    file: UploadFile = File(...),
    folder: str = Form("kigalifinders"),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="No file received")
    mime = file.content_type
    try:
        url = upload_image(data, file.filename or "image.jpg", folder=folder, mime_type=mime)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc
    return UploadResponse(url=url)


@router.get("/upload/status")
async def upload_status(user: Annotated[User, Depends(require_staff)]):
    from app.core.config import settings

    cloudinary_ready = bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )
    s3_ready = bool(
        settings.AWS_S3_BUCKET
        and settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
    )
    return {
        "configured": cloudinary_ready or s3_ready,
        "provider": "cloudinary" if cloudinary_ready else ("s3" if s3_ready else None),
    }


@router.get("/blog", response_model=list[AdminBlogPostListItem])
async def admin_list_blog(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(
        select(BlogPost).options(selectinload(BlogPost.category)).order_by(BlogPost.created_at.desc())
    )
    return [
        AdminBlogPostListItem(
            id=p.id, title=p.title, slug=p.slug, excerpt=p.excerpt,
            featured_image=p.featured_image,
            category_name=p.category.name if p.category else None,
            read_time_minutes=p.read_time_minutes, published_at=p.published_at,
            is_published=p.is_published, is_featured=p.is_featured,
        )
        for p in result.scalars().all()
    ]


@router.get("/blog/{post_id}", response_model=AdminBlogPostDetail)
async def admin_get_blog_post(
    post_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(
        select(BlogPost).options(selectinload(BlogPost.category)).where(BlogPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return AdminBlogPostDetail(
        id=post.id, title=post.title, slug=post.slug, excerpt=post.excerpt,
        featured_image=post.featured_image,
        category_name=post.category.name if post.category else None,
        read_time_minutes=post.read_time_minutes, published_at=post.published_at,
        is_published=post.is_published, is_featured=post.is_featured,
        content=post.content, content_format=post.content_format,
        meta_title=post.meta_title, meta_description=post.meta_description,
    )


@router.post("/blog", response_model=AdminBlogPostListItem, status_code=status.HTTP_201_CREATED)
async def create_blog_post(
    data: BlogPostCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    post = BlogPost(
        title=data.title,
        slug=data.slug or slugify(data.title),
        excerpt=data.excerpt,
        content=data.content,
        content_format=data.content_format,
        featured_image=data.featured_image,
        read_time_minutes=data.read_time_minutes,
        is_published=data.is_published,
        is_featured=data.is_featured,
        meta_title=data.meta_title,
        meta_description=data.meta_description,
        published_at=datetime.now(timezone.utc) if data.is_published else None,
    )
    db.add(post)
    await db.flush()
    return AdminBlogPostListItem(
        id=post.id, title=post.title, slug=post.slug, excerpt=post.excerpt,
        featured_image=post.featured_image, category_name=None,
        read_time_minutes=post.read_time_minutes, published_at=post.published_at,
        is_published=post.is_published, is_featured=post.is_featured,
    )


@router.patch("/blog/{post_id}", response_model=AdminBlogPostListItem)
async def update_blog_post(
    post_id: UUID,
    data: BlogPostUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    updates = data.model_dump(exclude_unset=True)
    if updates.get("is_published") and not post.published_at:
        updates["published_at"] = datetime.now(timezone.utc)
    if "title" in updates and "slug" not in updates:
        updates["slug"] = slugify(updates["title"])
    for field, value in updates.items():
        setattr(post, field, value)
    await db.flush()
    return AdminBlogPostListItem(
        id=post.id, title=post.title, slug=post.slug, excerpt=post.excerpt,
        featured_image=post.featured_image, category_name=None,
        read_time_minutes=post.read_time_minutes, published_at=post.published_at,
        is_published=post.is_published, is_featured=post.is_featured,
    )


@router.delete("/blog/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog_post(
    post_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await db.delete(post)


@router.get("/faqs", response_model=list[FAQResponse])
async def admin_list_faqs(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(FAQ).order_by(FAQ.sort_order))
    return [FAQResponse.model_validate(f) for f in result.scalars().all()]


@router.post("/faqs", response_model=FAQResponse, status_code=status.HTTP_201_CREATED)
async def create_faq(
    data: FAQCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    faq = FAQ(**data.model_dump())
    db.add(faq)
    await db.flush()
    return FAQResponse.model_validate(faq)


@router.patch("/faqs/{faq_id}", response_model=FAQResponse)
async def update_faq(
    faq_id: UUID,
    data: FAQUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(FAQ).where(FAQ.id == faq_id))
    faq = result.scalar_one_or_none()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(faq, field, value)
    await db.flush()
    return FAQResponse.model_validate(faq)


@router.delete("/faqs/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faq(
    faq_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(FAQ).where(FAQ.id == faq_id))
    faq = result.scalar_one_or_none()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    await db.delete(faq)


@router.get("/settings")
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(Setting))
    return {s.key: s.value for s in result.scalars().all()}


@router.patch("/settings")
async def update_settings(
    updates: list[SettingUpdate],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    for item in updates:
        result = await db.execute(select(Setting).where(Setting.key == item.key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = item.value
            flag_modified(setting, "value")
        else:
            db.add(Setting(key=item.key, value=item.value))
    await db.flush()
    result = await db.execute(select(Setting))
    return {s.key: s.value for s in result.scalars().all()}
