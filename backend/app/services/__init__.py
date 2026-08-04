import secrets
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from slugify import slugify
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import create_access_token, create_refresh_token, get_password_hash, verify_password
from app.models import (
    BlogPost,
    ContactMessage,
    District,
    FAQ,
    Neighborhood,
    Newsletter,
    Property,
    PropertyStatusEnum,
    Role,
    Setting,
    Testimonial,
    User,
)
from app.services.location_counts import sync_location_counts
from app.repositories.property_repository import PropertyRepository
from app.schemas import (
    BlogPostListItem,
    DashboardStats,
    DistrictResponse,
    FAQResponse,
    HomepageData,
    NeighborhoodResponse,
    PropertyListItem,
    SiteStats,
    TestimonialResponse,
    UserCreate,
)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.role)).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def register(self, data: UserCreate) -> User:
        existing = await self.get_user_by_email(data.email)
        if existing:
            raise ValueError("Email already registered")
        role_result = await self.db.execute(select(Role).where(Role.name == "customer"))
        role = role_result.scalar_one_or_none()
        user = User(
            email=data.email,
            hashed_password=get_password_hash(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
            role_id=role.id if role else None,
            verification_token=secrets.token_urlsafe(32),
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def authenticate(self, email: str, password: str) -> Optional[User]:
        user = await self.get_user_by_email(email)
        if not user or not user.hashed_password or not verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
        user.last_login = datetime.now(timezone.utc)
        await self.db.flush()
        return user

    def create_tokens(self, user: User) -> dict:
        return {
            "access_token": create_access_token(user.id),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
        }


class HomepageService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _merge_site_links(settings_map: dict) -> dict:
        site = settings_map.get("site") or {}
        links = settings_map.get("links") or {}
        booking_url = links.get("booking_url") or site.get("booking_url")
        return {
            "booking_url": booking_url,
            "book_consultation_url": links.get("book_consultation_url") or booking_url,
            "phone": links.get("phone") or site.get("phone"),
            "whatsapp": links.get("whatsapp") or site.get("whatsapp"),
        }

    async def get_homepage_data(self) -> HomepageData:
        await sync_location_counts(self.db)
        prop_repo = PropertyRepository(self.db)

        total_props = (
            await self.db.execute(
                select(func.count()).select_from(Property).where(Property.status == PropertyStatusEnum.PUBLISHED)
            )
        ).scalar() or 0

        settings_result = await self.db.execute(select(Setting))
        settings_map = {s.key: s.value for s in settings_result.scalars().all()}

        stats = SiteStats(
            properties_listed=total_props or settings_map.get("stats", {}).get("properties_listed", 1200),
            happy_clients=settings_map.get("stats", {}).get("happy_clients", 850),
            years_experience=settings_map.get("stats", {}).get("years_experience", 10),
            client_rating=settings_map.get("stats", {}).get("client_rating", 4.9),
        )

        featured = await prop_repo.get_featured(limit=9)
        furnished = await prop_repo.get_featured_furnished(limit=6)
        plots = await prop_repo.get_featured_plots(limit=6)

        testimonials_result = await self.db.execute(
            select(Testimonial).where(Testimonial.is_active == True, Testimonial.is_featured == True).limit(3)
        )
        testimonials = [
            TestimonialResponse.model_validate(t) for t in testimonials_result.scalars().all()
        ]

        districts_result = await self.db.execute(
            select(District).where(District.is_active == True).order_by(District.property_count.desc()).limit(8)
        )
        districts = [DistrictResponse.model_validate(d) for d in districts_result.scalars().all()]

        neighborhoods_result = await self.db.execute(
            select(Neighborhood)
            .options(selectinload(Neighborhood.district))
            .where(Neighborhood.is_active == True)
            .order_by(Neighborhood.property_count.desc())
        )
        neighborhoods = [
            NeighborhoodResponse(
                id=n.id, name=n.name, slug=n.slug, image_url=n.image_url,
                property_count=n.property_count, district_name=n.district.name if n.district else None,
            )
            for n in neighborhoods_result.scalars().all()
        ]

        blog_result = await self.db.execute(
            select(BlogPost)
            .options(selectinload(BlogPost.category))
            .where(BlogPost.is_published == True, BlogPost.is_featured == True)
            .order_by(BlogPost.published_at.desc())
            .limit(3)
        )
        blog_posts = [
            BlogPostListItem(
                id=p.id, title=p.title, slug=p.slug, excerpt=p.excerpt,
                featured_image=p.featured_image,
                category_name=p.category.name if p.category else None,
                read_time_minutes=p.read_time_minutes, published_at=p.published_at,
            )
            for p in blog_result.scalars().all()
        ]

        faq_result = await self.db.execute(
            select(FAQ).where(FAQ.is_active == True).order_by(FAQ.sort_order).limit(10)
        )
        faqs = [FAQResponse.model_validate(f) for f in faq_result.scalars().all()]

        return HomepageData(
            stats=stats,
            featured_properties=featured,
            featured_furnished=furnished,
            featured_plots=plots,
            testimonials=testimonials,
            districts=districts,
            neighborhoods=neighborhoods,
            blog_posts=blog_posts,
            faqs=faqs,
            hero=settings_map.get("hero"),
            settings=settings_map.get("site"),
            links=HomepageService._merge_site_links(settings_map),
        )


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self) -> DashboardStats:
        total_properties = (await self.db.execute(select(func.count()).select_from(Property))).scalar() or 0
        published = (await self.db.execute(
            select(func.count()).select_from(Property).where(Property.status == PropertyStatusEnum.PUBLISHED)
        )).scalar() or 0
        total_users = (await self.db.execute(select(func.count()).select_from(User))).scalar() or 0
        from app.models import Agent, Appointment
        total_agents = (await self.db.execute(select(func.count()).select_from(Agent))).scalar() or 0
        pending_appts = (await self.db.execute(
            select(func.count()).select_from(Appointment).where(Appointment.status == "pending")
        )).scalar() or 0
        unread = (await self.db.execute(
            select(func.count()).select_from(ContactMessage).where(ContactMessage.is_read == False)
        )).scalar() or 0
        subscribers = (await self.db.execute(
            select(func.count()).select_from(Newsletter).where(Newsletter.is_active == True)
        )).scalar() or 0
        total_views = (await self.db.execute(select(func.sum(Property.views_count)))).scalar() or 0

        return DashboardStats(
            total_properties=total_properties,
            published_properties=published,
            total_users=total_users,
            total_agents=total_agents,
            pending_appointments=pending_appts,
            unread_messages=unread,
            newsletter_subscribers=subscribers,
            total_views=int(total_views),
        )
