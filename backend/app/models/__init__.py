import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    AGENT = "agent"
    EDITOR = "editor"
    CUSTOMER = "customer"
    GUEST = "guest"


class PropertyStatusEnum(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    SOLD = "sold"
    RENTED = "rented"


class ListingType(str, enum.Enum):
    RENT = "rent"
    SALE = "sale"
    FURNISHED = "furnished"


class ObservationStatus(str, enum.Enum):
    ACTIVE_OBSERVED = "active_observed"
    NOT_FOUND = "not_found"
    PRICE_CHANGED = "price_changed"
    UNKNOWN = "unknown"
    INVALID = "invalid"


class SourcePolicyStatus(str, enum.Enum):
    NOT_REVIEWED = "not_reviewed"
    REVIEWED_OK = "reviewed_ok"
    REVIEWED_RESTRICTED = "reviewed_restricted"
    BLOCKED = "blocked"


class CollectionRunStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class SearchIndexStatus(str, enum.Enum):
    DISCOVERED = "discovered"
    DRAFT = "draft"
    NOINDEX = "noindex"
    INDEXABLE = "indexable"
    DISABLED = "disabled"


class SitemapStatus(str, enum.Enum):
    INCLUDED = "included"
    EXCLUDED = "excluded"


class SeoControl(str, enum.Enum):
    AUTOMATIC = "automatic"
    MANUAL = "manual"


class AutomaticEligibility(str, enum.Enum):
    ELIGIBLE = "eligible"
    EXCLUDED = "excluded"


class MarketDataKind(str, enum.Enum):
    VERIFIED_KIGALI_RENT = "verified_kigali_rent"
    MARKET_OBSERVATION = "market_observation"
    OFFICIAL = "official"


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

property_amenities = Table(
    "property_amenities",
    Base.metadata,
    Column("property_id", UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), primary_key=True),
    Column("amenity_id", UUID(as_uuid=True), ForeignKey("amenities.id", ondelete="CASCADE"), primary_key=True),
)

blog_post_tags = Table(
    "blog_post_tags",
    Base.metadata,
    Column("blog_post_id", UUID(as_uuid=True), ForeignKey("blog_posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    permissions: Mapped[list["Permission"]] = relationship(secondary=role_permissions, back_populates="roles")
    users: Mapped[list["User"]] = relationship(back_populates="role")


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    codename: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    roles: Mapped[list[Role]] = relationship(secondary=role_permissions, back_populates="permissions")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(30))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    facebook_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    role_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"))
    reset_token: Mapped[str | None] = mapped_column(String(255))
    verification_token: Mapped[str | None] = mapped_column(String(255))
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    role: Mapped[Role | None] = relationship(back_populates="users")
    agent_profile: Mapped["Agent | None"] = relationship(back_populates="user", uselist=False)
    customer_profile: Mapped["Customer | None"] = relationship(back_populates="user", uselist=False)
    saved_properties: Mapped[list["SavedProperty"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")
    activity_logs: Mapped[list["ActivityLog"]] = relationship(back_populates="user")

    @property
    def full_name(self) -> str:
        return f"{self.first_name or ''} {self.last_name or ''}".strip() or self.email


class City(Base):
    __tablename__ = "cities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    country: Mapped[str] = mapped_column(String(100), default="Rwanda")
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    districts: Mapped[list["District"]] = relationship(back_populates="city")


class District(Base):
    __tablename__ = "districts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    city_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cities.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500))
    property_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    city: Mapped[City] = relationship(back_populates="districts")
    neighborhoods: Mapped[list["Neighborhood"]] = relationship(back_populates="district")
    properties: Mapped[list["Property"]] = relationship(back_populates="district")


class Neighborhood(Base):
    __tablename__ = "neighborhoods"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500))
    property_count: Mapped[int] = mapped_column(Integer, default=0)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    district: Mapped[District] = relationship(back_populates="neighborhoods")
    properties: Mapped[list["Property"]] = relationship(back_populates="neighborhood")


class PropertyType(Base):
    __tablename__ = "property_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    properties: Mapped[list["Property"]] = relationship(back_populates="property_type")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Amenity(Base):
    __tablename__ = "amenities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50))
    category: Mapped[str | None] = mapped_column(String(50))

    properties: Mapped[list["Property"]] = relationship(secondary=property_amenities, back_populates="amenities")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    bio: Mapped[str | None] = mapped_column(Text)
    license_number: Mapped[str | None] = mapped_column(String(100))
    years_experience: Mapped[int] = mapped_column(Integer, default=0)
    specializations: Mapped[list | None] = mapped_column(JSONB, default=list)
    whatsapp: Mapped[str | None] = mapped_column(String(30))
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    properties_sold: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="agent_profile")
    properties: Mapped[list["Property"]] = relationship(back_populates="agent")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    preferences: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    budget_min: Mapped[float | None] = mapped_column(Float)
    budget_max: Mapped[float | None] = mapped_column(Float)
    preferred_locations: Mapped[list | None] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="customer_profile")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="customer")
    viewing_requests: Mapped[list["ViewingRequest"]] = relationship(back_populates="customer")


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    short_description: Mapped[str | None] = mapped_column(String(500))

    listing_type: Mapped[ListingType] = mapped_column(Enum(ListingType), default=ListingType.RENT)
    status: Mapped[PropertyStatusEnum] = mapped_column(Enum(PropertyStatusEnum), default=PropertyStatusEnum.DRAFT)

    price: Mapped[float] = mapped_column(Float, nullable=False)
    previous_price: Mapped[float | None] = mapped_column(Float)
    price_period: Mapped[str | None] = mapped_column(String(20), default="month")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    original_price: Mapped[float | None] = mapped_column(Float)
    original_currency: Mapped[str | None] = mapped_column(String(3))
    usd_price: Mapped[float | None] = mapped_column(Float, index=True)
    exchange_rate: Mapped[float | None] = mapped_column(Float)
    exchange_rate_date: Mapped[object | None] = mapped_column(Date)
    exchange_rate_source: Mapped[str | None] = mapped_column(String(100))
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    data_source_kind: Mapped[str] = mapped_column(String(40), default="verified_kigali_rent")

    bedrooms: Mapped[int | None] = mapped_column(Integer)
    bathrooms: Mapped[int | None] = mapped_column(Integer)
    area_sqm: Mapped[float | None] = mapped_column(Float)
    lot_size_sqm: Mapped[float | None] = mapped_column(Float)
    year_built: Mapped[int | None] = mapped_column(Integer)
    parking_spaces: Mapped[int | None] = mapped_column(Integer)
    floors: Mapped[int | None] = mapped_column(Integer)

    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    district_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("districts.id"))
    neighborhood_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("neighborhoods.id"))
    property_type_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("property_types.id"))
    property_type_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"))
    agent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id"))

    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    is_furnished: Mapped[bool] = mapped_column(Boolean, default=False)
    has_title_deed: Mapped[bool] = mapped_column(Boolean, default=False)
    virtual_tour_url: Mapped[str | None] = mapped_column(String(500))
    floor_plan_url: Mapped[str | None] = mapped_column(String(500))
    tour_360_url: Mapped[str | None] = mapped_column(String(500))
    badge_label: Mapped[str | None] = mapped_column(String(50))

    realtor_name: Mapped[str | None] = mapped_column(String(120))
    has_balcony: Mapped[bool] = mapped_column(Boolean, default=False)
    has_kitchen: Mapped[bool] = mapped_column(Boolean, default=False)
    has_pool: Mapped[bool] = mapped_column(Boolean, default=False)
    has_parking: Mapped[bool] = mapped_column(Boolean, default=False)
    has_jacuzzi: Mapped[bool] = mapped_column(Boolean, default=False)
    has_garden: Mapped[bool] = mapped_column(Boolean, default=False)
    pets_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    show_features_table: Mapped[bool] = mapped_column(Boolean, default=True)

    views_count: Mapped[int] = mapped_column(Integer, default=0)
    meta_title: Mapped[str | None] = mapped_column(String(255))
    meta_description: Mapped[str | None] = mapped_column(String(500))
    meta_keywords: Mapped[str | None] = mapped_column(String(500))

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    district: Mapped[District | None] = relationship(back_populates="properties")
    neighborhood: Mapped[Neighborhood | None] = relationship(back_populates="properties")
    property_type: Mapped[PropertyType | None] = relationship(back_populates="properties")
    agent: Mapped[Agent | None] = relationship(back_populates="properties")
    amenities: Mapped[list[Amenity]] = relationship(secondary=property_amenities, back_populates="properties")
    images: Mapped[list["PropertyImage"]] = relationship(back_populates="property", cascade="all, delete-orphan")
    videos: Mapped[list["PropertyVideo"]] = relationship(back_populates="property", cascade="all, delete-orphan")
    price_history: Mapped[list["PriceHistory"]] = relationship(back_populates="property", cascade="all, delete-orphan")
    reviews: Mapped[list["Review"]] = relationship(back_populates="property")
    saved_by: Mapped[list["SavedProperty"]] = relationship(back_populates="property")


class PropertyImage(Base):
    __tablename__ = "property_images"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    property: Mapped[Property] = relationship(back_populates="images")


class PropertyVideo(Base):
    __tablename__ = "property_videos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    property: Mapped[Property] = relationship(back_populates="videos")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"))
    price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    property: Mapped[Property] = relationship(back_populates="price_history")


class SavedProperty(Base):
    __tablename__ = "saved_properties"
    __table_args__ = (UniqueConstraint("user_id", "property_id", name="uq_saved_property"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="saved_properties")
    property: Mapped[Property] = relationship(back_populates="saved_by")


class CompareProperty(Base):
    __tablename__ = "compare_properties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str] = mapped_column(String(100), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    property_ids: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"))
    property_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id"))
    agent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    customer: Mapped[Customer | None] = relationship(back_populates="appointments")


class ViewingRequest(Base):
    __tablename__ = "viewing_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"))
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    preferred_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    customer: Mapped[Customer | None] = relationship(back_populates="viewing_requests")


class Testimonial(Base):
    __tablename__ = "testimonials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    rating: Mapped[int] = mapped_column(Integer, default=5)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(Text)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    property: Mapped[Property | None] = relationship(back_populates="reviews")


class BlogCategory(Base):
    __tablename__ = "blog_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    posts: Mapped[list["BlogPost"]] = relationship(back_populates="category")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)

    posts: Mapped[list["BlogPost"]] = relationship(secondary=blog_post_tags, back_populates="tags")


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(350), unique=True, index=True, nullable=False)
    excerpt: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_format: Mapped[str] = mapped_column(String(20), default="markdown")
    featured_image: Mapped[str | None] = mapped_column(String(500))
    author_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("blog_categories.id"))
    read_time_minutes: Mapped[int] = mapped_column(Integer, default=5)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    views_count: Mapped[int] = mapped_column(Integer, default=0)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    meta_title: Mapped[str | None] = mapped_column(String(255))
    meta_description: Mapped[str | None] = mapped_column(String(500))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    category: Mapped[BlogCategory | None] = relationship(back_populates="posts")
    tags: Mapped[list[Tag]] = relationship(secondary=blog_post_tags, back_populates="posts")


class FAQ(Base):
    __tablename__ = "faqs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    subject: Mapped[str | None] = mapped_column(String(300))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Newsletter(Base):
    __tablename__ = "newsletters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    subscribed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ListingAlert(Base):
    """Saved search / match alert from the public WhatsApp alert form."""

    __tablename__ = "listing_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    budget: Mapped[str | None] = mapped_column(String(120))
    area: Mapped[str | None] = mapped_column(String(255))
    bedrooms: Mapped[str | None] = mapped_column(String(40))
    intent: Mapped[str | None] = mapped_column(String(40))  # rent | buy | any
    search_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    link: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="notifications")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[str | None] = mapped_column(String(100))
    details: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User | None] = relationship(back_populates="activity_logs")


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[dict | None] = mapped_column(JSONB)
    group: Mapped[str | None] = mapped_column(String(50))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class SEO(Base):
    __tablename__ = "seo"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    meta_title: Mapped[str | None] = mapped_column(String(255))
    meta_description: Mapped[str | None] = mapped_column(String(500))
    meta_keywords: Mapped[str | None] = mapped_column(String(500))
    og_title: Mapped[str | None] = mapped_column(String(255))
    og_description: Mapped[str | None] = mapped_column(String(500))
    og_image: Mapped[str | None] = mapped_column(String(500))
    canonical_url: Mapped[str | None] = mapped_column(String(500))
    structured_data: Mapped[dict | None] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(500))
    image_url: Mapped[str | None] = mapped_column(String(500))
    link_url: Mapped[str | None] = mapped_column(String(500))
    position: Mapped[str] = mapped_column(String(50), default="hero")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Advertisement(Base):
    __tablename__ = "advertisements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500))
    link_url: Mapped[str | None] = mapped_column(String(500))
    placement: Mapped[str] = mapped_column(String(50), default="sidebar")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)


class Media(Base):
    __tablename__ = "media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    alt_text: Mapped[str | None] = mapped_column(String(255))
    folder: Mapped[str | None] = mapped_column(String(100))
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Analytics(Base):
    __tablename__ = "analytics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[str | None] = mapped_column(String(100))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    session_id: Mapped[str | None] = mapped_column(String(100))
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"
    __table_args__ = (
        UniqueConstraint("base_currency", "quote_currency", "rate_date", "source", name="uq_exchange_rate_day_source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    quote_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate: Mapped[float] = mapped_column(Float, nullable=False)
    rate_date: Mapped[object] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RentalObservation(Base):
    """Append-only market observation. Never overwrite historical rows for price history."""

    __tablename__ = "rental_observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(500))
    source_listing_id: Mapped[str | None] = mapped_column(String(120))
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    first_observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    property_type: Mapped[str | None] = mapped_column(String(80))
    bedrooms: Mapped[int | None] = mapped_column(Integer)
    bathrooms: Mapped[float | None] = mapped_column(Float)
    size_sqm: Mapped[float | None] = mapped_column(Float)
    neighborhood: Mapped[str | None] = mapped_column(String(120))
    neighborhood_slug: Mapped[str | None] = mapped_column(String(120))
    district: Mapped[str | None] = mapped_column(String(120))
    asking_price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    usd_price: Mapped[float | None] = mapped_column(Float)
    exchange_rate: Mapped[float | None] = mapped_column(Float)
    exchange_rate_date: Mapped[object | None] = mapped_column(Date)
    exchange_rate_source: Mapped[str | None] = mapped_column(String(100))
    is_furnished: Mapped[bool | None] = mapped_column(Boolean)
    amenities: Mapped[list | None] = mapped_column(JSONB)
    rental_term: Mapped[str | None] = mapped_column(String(80))
    observation_status: Mapped[str] = mapped_column(String(40), default=ObservationStatus.ACTIVE_OBSERVED.value)
    confidence: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MarketStatSnapshot(Base):
    __tablename__ = "market_stat_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start: Mapped[object] = mapped_column(Date, nullable=False)
    period_end: Mapped[object] = mapped_column(Date, nullable=False)
    granularity: Mapped[str] = mapped_column(String(20), default="month")
    location_slug: Mapped[str] = mapped_column(String(120), nullable=False)
    location_name: Mapped[str | None] = mapped_column(String(120))
    property_type: Mapped[str | None] = mapped_column(String(80))
    bedrooms: Mapped[int | None] = mapped_column(Integer)
    is_furnished: Mapped[bool | None] = mapped_column(Boolean)
    data_kind: Mapped[str] = mapped_column(String(40), nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    median_usd: Mapped[float | None] = mapped_column(Float)
    p25_usd: Mapped[float | None] = mapped_column(Float)
    p75_usd: Mapped[float | None] = mapped_column(Float)
    min_usd: Mapped[float | None] = mapped_column(Float)
    max_usd: Mapped[float | None] = mapped_column(Float)
    common_amenities: Mapped[list | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SearchIntent(Base):
    __tablename__ = "search_intents"
    __table_args__ = (
        UniqueConstraint("location_slug", "intent_slug", name="uq_search_intent_path_parts"),
        UniqueConstraint("path", name="uq_search_intent_path"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_slug: Mapped[str] = mapped_column(String(120), nullable=False)
    intent_slug: Mapped[str] = mapped_column(String(200), nullable=False)
    path: Mapped[str] = mapped_column(String(320), nullable=False)
    query: Mapped[dict] = mapped_column(JSONB, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    h1: Mapped[str] = mapped_column(String(255), nullable=False)
    meta_description: Mapped[str | None] = mapped_column(String(500))
    intro_html: Mapped[str | None] = mapped_column(Text)
    quality_score: Mapped[float] = mapped_column(Float, default=0)
    opportunity_score: Mapped[float] = mapped_column(Float, default=0, index=True)
    index_status: Mapped[str] = mapped_column(String(40), default=SearchIndexStatus.DRAFT.value, index=True)
    sitemap_status: Mapped[str] = mapped_column(String(20), default=SitemapStatus.EXCLUDED.value, index=True)
    seo_control: Mapped[str] = mapped_column(String(20), default=SeoControl.AUTOMATIC.value, index=True)
    automatic_eligibility: Mapped[str] = mapped_column(
        String(20), default=AutomaticEligibility.EXCLUDED.value, index=True
    )
    match_count: Mapped[int] = mapped_column(Integer, default=0)
    matching_observation_count: Mapped[int] = mapped_column(Integer, default=0)
    last_built_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_calculated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_content_change_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    data_freshness: Mapped[str] = mapped_column(String(20), default="unknown")
    status_reason: Mapped[str | None] = mapped_column(String(500))
    canonical_query_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    source: Mapped[str] = mapped_column(String(40), default="manual", index=True)
    locked_by_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    automation_disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    gsc_impressions: Mapped[int | None] = mapped_column(Integer)
    gsc_clicks: Mapped[int | None] = mapped_column(Integer)
    gsc_ctr: Mapped[float | None] = mapped_column(Float)
    gsc_position: Mapped[float | None] = mapped_column(Float)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    relations_from: Mapped[list["SearchLandingRelation"]] = relationship(
        foreign_keys="SearchLandingRelation.from_intent_id",
        back_populates="from_intent",
        cascade="all, delete-orphan",
    )


class SearchLandingRelation(Base):
    __tablename__ = "search_landing_relations"
    __table_args__ = (UniqueConstraint("from_intent_id", "to_intent_id", name="uq_search_landing_relation"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_intent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("search_intents.id", ondelete="CASCADE"))
    to_intent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("search_intents.id", ondelete="CASCADE"))
    relation_type: Mapped[str] = mapped_column(String(40), default="related")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    from_intent: Mapped[SearchIntent] = relationship(foreign_keys=[from_intent_id], back_populates="relations_from")
    to_intent: Mapped[SearchIntent] = relationship(foreign_keys=[to_intent_id])


class GscQuerySuggestion(Base):
    __tablename__ = "gsc_query_suggestions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query: Mapped[str] = mapped_column(String(500), nullable=False)
    impressions: Mapped[int | None] = mapped_column(Integer)
    clicks: Mapped[int | None] = mapped_column(Integer)
    ctr: Mapped[float | None] = mapped_column(Float)
    position: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(40), default="pending_review")
    suggested_path: Mapped[str | None] = mapped_column(String(320))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class IntentAutomationSetting(Base):
    __tablename__ = "intent_automation_settings"
    __table_args__ = (UniqueConstraint("key", name="uq_intent_automation_settings_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ExternalMarketSource(Base):
    """Per-source control plane for external observations (separate from verified inventory)."""

    __tablename__ = "external_market_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(500))
    robots_url: Mapped[str | None] = mapped_column(String(500))
    preferred_ingest: Mapped[str] = mapped_column(String(20), default="csv")
    collection_method: Mapped[str] = mapped_column(String(20), default="csv")  # csv | automated
    policy_status: Mapped[str] = mapped_column(String(40), default=SourcePolicyStatus.NOT_REVIEWED.value)
    policy_notes: Mapped[str | None] = mapped_column(Text)
    robots_summary: Mapped[str | None] = mapped_column(Text)
    robots_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    automated_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    listing_adapter_ready: Mapped[bool] = mapped_column(Boolean, default=False)
    last_crawl_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_import_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    consecutive_errors: Mapped[int] = mapped_column(Integer, default=0)
    observation_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ExternalCollectionRun(Base):
    """Background collection job progress for admin visibility."""

    __tablename__ = "external_collection_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status: Mapped[str] = mapped_column(String(40), default=CollectionRunStatus.QUEUED.value, index=True)
    mode: Mapped[str] = mapped_column(String(40), default="selected")  # selected | all_enabled | single | csv_import
    source_ids: Mapped[list | None] = mapped_column(JSONB)
    current_source_id: Mapped[str | None] = mapped_column(String(80))
    progress: Mapped[dict | None] = mapped_column(JSONB)
    observations_found: Mapped[int] = mapped_column(Integer, default=0)
    observations_new: Mapped[int] = mapped_column(Integer, default=0)
    observations_updated: Mapped[int] = mapped_column(Integer, default=0)
    duplicates: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list | None] = mapped_column(JSONB)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ObservationImportBatch(Base):
    """Public reference for CSV observation imports (e.g. DATA-0825). Raw CSV is never exposed."""

    __tablename__ = "observation_import_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    rows_processed: Mapped[int] = mapped_column(Integer, default=0)
    rows_new: Mapped[int] = mapped_column(Integer, default=0)
    rows_updated: Mapped[int] = mapped_column(Integer, default=0)
    sources: Mapped[list | None] = mapped_column(JSONB)
    period_start: Mapped[object | None] = mapped_column(Date)
    period_end: Mapped[object | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
