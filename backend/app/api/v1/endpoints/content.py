from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_admin
from app.database.session import get_db
from app.core.legal_defaults import DEFAULT_LEGAL
from app.models import BlogPost, ContactMessage, FAQ, Newsletter, Setting, Testimonial, User
from app.schemas import (
    AppointmentCreate,
    BlogPostDetail,
    BlogPostListItem,
    ContactCreate,
    DashboardStats,
    FAQResponse,
    HomepageData,
    LegalContentResponse,
    NewsletterSubscribe,
    TestimonialResponse,
    ViewingRequestCreate,
)
from app.services import DashboardService, HomepageService

router = APIRouter(tags=["Public Content"])


@router.get("/homepage", response_model=HomepageData)
async def homepage(db: Annotated[AsyncSession, Depends(get_db)]):
    return await HomepageService(db).get_homepage_data()


@router.get("/testimonials", response_model=list[TestimonialResponse])
async def testimonials(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Testimonial).where(Testimonial.is_active == True).order_by(Testimonial.sort_order)
    )
    return [TestimonialResponse.model_validate(t) for t in result.scalars().all()]


@router.get("/faqs", response_model=list[FAQResponse])
async def faqs(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(FAQ).where(FAQ.is_active == True).order_by(FAQ.sort_order))
    return [FAQResponse.model_validate(f) for f in result.scalars().all()]


@router.get("/blog", response_model=list[BlogPostListItem])
async def blog_posts(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(BlogPost)
        .options(selectinload(BlogPost.category))
        .where(BlogPost.status == "published")
        .order_by(BlogPost.published_at.desc())
    )
    return [
        BlogPostListItem(
            id=p.id, title=p.title, slug=p.slug, excerpt=p.excerpt,
            featured_image=p.featured_image,
            category_name=p.category.name if p.category else None,
            read_time_minutes=p.read_time_minutes, published_at=p.published_at,
        )
        for p in result.scalars().all()
    ]


@router.get("/blog/{slug}", response_model=BlogPostDetail)
async def blog_detail(slug: str, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(BlogPost)
        .options(selectinload(BlogPost.category), selectinload(BlogPost.tags))
        .where(BlogPost.slug == slug, BlogPost.status == "published")
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    # Views are recorded via POST /blog/{slug}/view (qualified client dwell), not on every SSR fetch.
    return BlogPostDetail(
        id=post.id, title=post.title, slug=post.slug, excerpt=post.excerpt,
        featured_image=post.featured_image,
        category_name=post.category.name if post.category else None,
        read_time_minutes=post.read_time_minutes, published_at=post.published_at,
        content=post.content, content_format=post.content_format,
        meta_title=post.meta_title, meta_description=post.meta_description,
        tags=[t.name for t in post.tags], views_count=post.views_count, likes_count=post.likes_count,
    )


@router.post("/blog/{slug}/view", status_code=status.HTTP_204_NO_CONTENT)
async def record_blog_view(
    slug: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    session_id: Annotated[str | None, Header(alias="X-View-Session")] = None,
):
    from datetime import datetime, timedelta, timezone
    from fastapi.responses import Response
    from app.models import Analytics

    result = await db.execute(
        select(BlogPost).where(BlogPost.slug == slug, BlogPost.status == "published")
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    visitor = (session_id or "").strip()[:100] or None
    if not visitor:
        ua = (request.headers.get("user-agent") or "")[:80]
        ip = request.client.host if request.client else ""
        visitor = f"{ip}:{ua}"[:100]

    since = datetime.now(timezone.utc) - timedelta(hours=12)
    existing = await db.execute(
        select(Analytics.id)
        .where(
            Analytics.event_type == "blog_view",
            Analytics.entity_id == str(post.id),
            Analytics.session_id == visitor,
            Analytics.created_at >= since,
        )
        .limit(1)
    )
    if existing.scalar_one_or_none():
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    db.add(
        Analytics(
            event_type="blog_view",
            entity_type="blog",
            entity_id=str(post.id),
            session_id=visitor,
            ip_address=request.client.host if request.client else None,
            user_agent=(request.headers.get("user-agent") or "")[:500] or None,
        )
    )
    post.views_count = int(post.views_count or 0) + 1
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/contact", status_code=status.HTTP_201_CREATED)
async def contact(data: ContactCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.services.lead_notify import notify_lead_whatsapp

    msg = ContactMessage(**data.model_dump())
    db.add(msg)
    await db.flush()
    await notify_lead_whatsapp(
        db,
        f"New contact form\nFrom: {data.name}\nEmail: {data.email}\nPhone: {data.phone or '—'}\n"
        f"Subject: {data.subject or '—'}\n{data.message}",
    )
    return {"message": "Thank you for contacting us"}


@router.post("/newsletter", status_code=status.HTTP_201_CREATED)
async def newsletter(data: NewsletterSubscribe, db: Annotated[AsyncSession, Depends(get_db)]):
    existing = await db.execute(select(Newsletter).where(Newsletter.email == data.email))
    if existing.scalar_one_or_none():
        return {"message": "Already subscribed"}
    db.add(Newsletter(email=data.email))
    await db.flush()
    return {"message": "Successfully subscribed"}


@router.post("/appointments", status_code=status.HTTP_201_CREATED)
async def create_appointment(data: AppointmentCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.models import Appointment
    from app.services.lead_notify import notify_lead_whatsapp

    appt = Appointment(**data.model_dump())
    db.add(appt)
    await db.flush()
    await notify_lead_whatsapp(
        db,
        f"New appointment request\nFrom: {data.name}\nEmail: {data.email}\nPhone: {data.phone or '—'}",
    )
    return {"message": "Appointment scheduled successfully", "id": str(appt.id)}


@router.get("/legal", response_model=LegalContentResponse)
async def legal_content(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Setting).where(Setting.key == "legal"))
    setting = result.scalar_one_or_none()
    value = setting.value if setting and setting.value else {}
    sitemap_intro = value.get("sitemap_intro") or value.get("sitemap") or DEFAULT_LEGAL["sitemap_intro"]
    return LegalContentResponse(
        privacy_policy=value.get("privacy_policy") or DEFAULT_LEGAL["privacy_policy"],
        terms_of_service=value.get("terms_of_service") or DEFAULT_LEGAL["terms_of_service"],
        sitemap_intro=sitemap_intro,
    )


@router.post("/viewing-requests", status_code=status.HTTP_201_CREATED)
async def create_viewing_request(data: ViewingRequestCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.models import ViewingRequest, Property
    from app.services.lead_notify import notify_lead_whatsapp

    req = ViewingRequest(**data.model_dump())
    db.add(req)
    await db.flush()

    prop = await db.get(Property, data.property_id)
    title = prop.title if prop else str(data.property_id)
    await notify_lead_whatsapp(
        db,
        f"New property inquiry\nListing: {title}\nFrom: {data.name}\nEmail: {data.email}\n"
        f"Phone: {data.phone or '—'}\n{data.message or ''}",
    )
    return {"message": "Viewing request submitted", "id": str(req.id)}


admin_router = APIRouter(prefix="/admin", tags=["Admin"])


@admin_router.get("/dashboard", response_model=DashboardStats)
async def dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_admin)],
):
    return await DashboardService(db).get_stats()
