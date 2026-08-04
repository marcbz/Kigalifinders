from datetime import datetime
from typing import Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    type: str


class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    role: Optional[str] = None
    created_at: datetime


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class PropertyImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    url: str
    alt_text: Optional[str] = None
    is_primary: bool
    sort_order: int


class PropertyListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    slug: str
    short_description: Optional[str] = None
    listing_type: str
    status: str
    price: float
    price_period: Optional[str] = None
    currency: str
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    area_sqm: Optional[float] = None
    lot_size_sqm: Optional[float] = None
    is_featured: bool
    is_premium: bool
    is_furnished: bool
    has_title_deed: bool
    badge_label: Optional[str] = None
    district_name: Optional[str] = None
    neighborhood_name: Optional[str] = None
    property_type_name: Optional[str] = None
    property_type_ids: List[str] = []
    primary_image: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    realtor_name: Optional[str] = None
    has_balcony: bool = False
    has_kitchen: bool = False
    has_pool: bool = False
    has_parking: bool = False
    has_jacuzzi: bool = False
    has_garden: bool = False
    pets_allowed: bool = False


class PropertyDetail(PropertyListItem):
    description: Optional[str] = None
    address: Optional[str] = None
    year_built: Optional[int] = None
    parking_spaces: Optional[int] = None
    floors: Optional[int] = None
    virtual_tour_url: Optional[str] = None
    floor_plan_url: Optional[str] = None
    tour_360_url: Optional[str] = None
    views_count: int
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    images: List[PropertyImageResponse] = []
    amenities: List[str] = []
    agent_name: Optional[str] = None
    agent_phone: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime


class PropertyImageInput(BaseModel):
    url: str
    alt_text: Optional[str] = None
    is_primary: bool = False
    sort_order: int = 0


class PropertyCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    listing_type: str = "rent"
    status: str = "draft"
    price: float
    price_period: Optional[str] = "month"
    currency: str = "USD"
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    area_sqm: Optional[float] = None
    lot_size_sqm: Optional[float] = None
    district_id: Optional[UUID] = None
    neighborhood_id: Optional[UUID] = None
    property_type_id: Optional[UUID] = None
    property_type_ids: List[str] = []
    agent_id: Optional[UUID] = None
    is_featured: bool = False
    is_premium: bool = False
    is_furnished: bool = False
    has_title_deed: bool = False
    badge_label: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    realtor_name: Optional[str] = None
    has_balcony: bool = False
    has_kitchen: bool = False
    has_pool: bool = False
    has_parking: bool = False
    has_jacuzzi: bool = False
    has_garden: bool = False
    pets_allowed: bool = False
    images: List[PropertyImageInput] = []


class PropertyUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    listing_type: Optional[str] = None
    status: Optional[str] = None
    price: Optional[float] = None
    price_period: Optional[str] = None
    currency: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    area_sqm: Optional[float] = None
    lot_size_sqm: Optional[float] = None
    district_id: Optional[UUID] = None
    neighborhood_id: Optional[UUID] = None
    property_type_id: Optional[UUID] = None
    property_type_ids: Optional[List[str]] = None
    agent_id: Optional[UUID] = None
    is_featured: Optional[bool] = None
    is_premium: Optional[bool] = None
    is_furnished: Optional[bool] = None
    has_title_deed: Optional[bool] = None
    badge_label: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    realtor_name: Optional[str] = None
    has_balcony: Optional[bool] = None
    has_kitchen: Optional[bool] = None
    has_pool: Optional[bool] = None
    has_parking: Optional[bool] = None
    has_jacuzzi: Optional[bool] = None
    has_garden: Optional[bool] = None
    pets_allowed: Optional[bool] = None
    images: Optional[List[PropertyImageInput]] = None


class PropertySearchParams(BaseModel):
    q: Optional[str] = None
    listing_type: Optional[str] = None
    district_id: Optional[UUID] = None
    neighborhood_id: Optional[UUID] = None
    neighborhood_slug: Optional[str] = None
    property_type_id: Optional[UUID] = None
    property_type_slug: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    is_featured: Optional[bool] = None
    is_furnished: Optional[bool] = None
    amenity_ids: Optional[List[UUID]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = None
    sort_by: str = "created_at"
    sort_order: str = "desc"
    page: int = 1
    page_size: int = 12


class TestimonialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    role: Optional[str] = None
    location: Optional[str] = None
    content: str
    avatar_url: Optional[str] = None
    rating: int


class BlogPostListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    slug: str
    excerpt: Optional[str] = None
    featured_image: Optional[str] = None
    category_name: Optional[str] = None
    read_time_minutes: int
    published_at: Optional[datetime] = None


class BlogPostDetail(BlogPostListItem):
    content: str
    content_format: str
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    tags: List[str] = []
    views_count: int
    likes_count: int


class FAQResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question: str
    answer: str
    category: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class FAQCreate(BaseModel):
    question: str
    answer: str
    category: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class AdminBlogPostListItem(BlogPostListItem):
    is_published: bool = False
    is_featured: bool = False


class AdminBlogPostDetail(AdminBlogPostListItem):
    content: str
    content_format: str = "html"
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class BlogPostCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: str
    content_format: str = "html"
    featured_image: Optional[str] = None
    read_time_minutes: int = 5
    is_published: bool = False
    is_featured: bool = False
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    content_format: Optional[str] = None
    featured_image: Optional[str] = None
    read_time_minutes: Optional[int] = None
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class UploadResponse(BaseModel):
    url: str


class ContactMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    phone: Optional[str] = None
    subject: Optional[str] = None
    message: str
    is_read: bool
    created_at: datetime


class ViewingRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    property_id: Optional[UUID] = None
    property_title: Optional[str] = None
    name: str
    email: str
    phone: Optional[str] = None
    message: Optional[str] = None
    status: str
    created_at: datetime


class SettingUpdate(BaseModel):
    key: str
    value: dict | list | str | int | float | bool | None


class DistrictResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    image_url: Optional[str] = None
    property_count: int


class PropertyTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str


class NeighborhoodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    image_url: Optional[str] = None
    property_count: int
    district_name: Optional[str] = None


class ContactCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    subject: Optional[str] = None
    message: str


class NewsletterSubscribe(BaseModel):
    email: EmailStr


class AppointmentCreate(BaseModel):
    property_id: Optional[UUID] = None
    name: str
    email: EmailStr
    phone: Optional[str] = None
    scheduled_at: datetime
    message: Optional[str] = None


class ViewingRequestCreate(BaseModel):
    property_id: UUID
    name: str
    email: EmailStr
    phone: Optional[str] = None
    preferred_date: Optional[datetime] = None
    message: Optional[str] = None


class SiteStats(BaseModel):
    properties_listed: int
    happy_clients: int
    years_experience: int
    client_rating: float


class HomepageData(BaseModel):
    stats: SiteStats
    featured_properties: List[PropertyListItem]
    featured_furnished: List[PropertyListItem] = []
    featured_plots: List[PropertyListItem]
    testimonials: List[TestimonialResponse]
    districts: List[DistrictResponse]
    neighborhoods: List[NeighborhoodResponse]
    blog_posts: List[BlogPostListItem]
    faqs: List[FAQResponse]
    hero: Optional[dict] = None
    settings: Optional[dict] = None
    links: Optional[dict] = None


class DashboardStats(BaseModel):
    total_properties: int
    published_properties: int
    total_users: int
    total_agents: int
    pending_appointments: int
    unread_messages: int
    newsletter_subscribers: int
    total_views: int
