"""Seed database with initial Kigalifinders data."""
import asyncio
from datetime import datetime, timezone

from slugify import slugify
from sqlalchemy import select

from app.core.security import get_password_hash
from app.database.base import Base
from app.database.session import AsyncSessionLocal, get_sync_engine
from app.models import (
    Amenity,
    BlogCategory,
    BlogPost,
    City,
    District,
    FAQ,
    ListingType,
    Neighborhood,
    Permission,
    Property,
    PropertyImage,
    PropertyStatusEnum,
    PropertyType,
    Role,
    Setting,
    Testimonial,
    User,
    role_permissions,
)


async def seed():
    sync_engine = get_sync_engine()
    Base.metadata.create_all(bind=sync_engine)

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(Role).limit(1))
        if existing.scalar_one_or_none():
            print("Database already seeded.")
            return

        roles_data = [
            ("super_admin", "Super Administrator"),
            ("admin", "Administrator"),
            ("agent", "Real Estate Agent"),
            ("editor", "Content Editor"),
            ("customer", "Customer"),
            ("guest", "Guest"),
        ]
        roles = {}
        for name, desc in roles_data:
            role = Role(name=name, description=desc)
            db.add(role)
            roles[name] = role
        await db.flush()

        admin = User(
            email="admin@kigalifinders.com",
            hashed_password=get_password_hash("Admin@123456"),
            first_name="Admin",
            last_name="Kigalifinders",
            is_active=True,
            is_verified=True,
            role_id=roles["super_admin"].id,
        )
        db.add(admin)

        city = City(name="Kigali", slug="kigali", country="Rwanda")
        db.add(city)
        await db.flush()

        districts_data = [
            ("Kicukiro", "kicukiro", 142, "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=600"),
            ("Gasabo", "gasabo", 218, "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=600"),
            ("Nyarugenge", "nyarugenge", 96, "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600"),
        ]
        districts = {}
        for name, slug, count, img in districts_data:
            d = District(city_id=city.id, name=name, slug=slug, property_count=count, image_url=img)
            db.add(d)
            districts[name] = d
        await db.flush()

        neighborhoods_data = [
            ("Rebero", "rebero", districts["Kicukiro"].id, 42),
            ("Nyarutarama", "nyarutarama", districts["Gasabo"].id, 68),
            ("Kibagabaga", "kibagabaga", districts["Gasabo"].id, 87),
            ("Kiyovu", "kiyovu", districts["Nyarugenge"].id, 40),
            ("Gisozi", "gisozi", districts["Gasabo"].id, 45),
            ("Remera", "remera", districts["Gasabo"].id, 50),
            ("Gacuriro", "gacuriro", districts["Gasabo"].id, 55),
            ("Kacyiru", "kacyiru", districts["Gasabo"].id, 73),
            ("Kimihurura", "kimihurura", districts["Gasabo"].id, 48),
            ("Kagarama", "kagarama", districts["Kicukiro"].id, 34),
            ("Kimironko", "kimironko", districts["Gasabo"].id, 52),
            ("Gasabo", "gasabo", districts["Gasabo"].id, 30),
            ("Nyarugenge", "nyarugenge", districts["Nyarugenge"].id, 28),
            ("Kicukiro", "kicukiro", districts["Kicukiro"].id, 35),
        ]
        neighborhoods = {}
        for name, slug, dist_id, count in neighborhoods_data:
            n = Neighborhood(district_id=dist_id, name=name, slug=slug, property_count=count)
            db.add(n)
            neighborhoods[name] = n
        await db.flush()

        types_data = ["House", "Apartment", "Villa", "Plot", "Commercial", "Townhouse"]
        ptypes = {}
        for t in types_data:
            pt = PropertyType(name=t, slug=slugify(t))
            db.add(pt)
            ptypes[t] = pt
        await db.flush()

        amenities_data = ["Swimming Pool", "Garden", "Security", "Parking", "Generator", "Air Conditioning"]
        for a in amenities_data:
            db.add(Amenity(name=a, slug=slugify(a)))
        await db.flush()

        properties_data = [
            {
                "title": "Luxury Villa, Nyarutarama",
                "listing_type": ListingType.RENT,
                "price": 3500,
                "bedrooms": 4, "bathrooms": 3, "area_sqm": 320,
                "district": "Gasabo", "neighborhood": "Nyarutarama",
                "ptype": "Villa", "badge": "For Rent", "featured": True,
                "image": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
            },
            {
                "title": "Modern Apartment, Kibagabaga",
                "listing_type": ListingType.FURNISHED,
                "price": 1200,
                "bedrooms": 2, "bathrooms": 2, "area_sqm": 120,
                "district": "Gasabo", "neighborhood": "Kibagabaga",
                "ptype": "Apartment", "badge": "Furnished", "featured": True, "furnished": True,
                "image": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
            },
            {
                "title": "Family Home, Kicukiro",
                "listing_type": ListingType.RENT,
                "price": 900,
                "bedrooms": 3, "bathrooms": 2, "area_sqm": 210,
                "district": "Kicukiro", "neighborhood": "Rebero",
                "ptype": "House", "badge": "New", "featured": True,
                "image": "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800",
            },
            {
                "title": "Hilltop Plot, Rebero",
                "listing_type": ListingType.SALE,
                "price": 85000,
                "lot_size_sqm": 1200,
                "district": "Kicukiro", "neighborhood": "Rebero",
                "ptype": "Plot", "badge": "For Sale", "featured": True, "title_deed": True,
                "image": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
            },
            {
                "title": "Residential Plot, Bumbogo",
                "listing_type": ListingType.SALE,
                "price": 45000,
                "lot_size_sqm": 800,
                "district": "Gasabo", "neighborhood": "Kibagabaga",
                "ptype": "Plot", "badge": "Prime", "featured": True, "title_deed": True,
                "image": "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800",
            },
            {
                "title": "City Penthouse, Nyarugenge",
                "listing_type": ListingType.RENT,
                "price": 2800,
                "bedrooms": 3, "bathrooms": 3, "area_sqm": 250,
                "district": "Nyarugenge", "neighborhood": "Nyarutarama",
                "ptype": "Apartment", "badge": "Premium", "featured": True, "premium": True,
                "image": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
            },
        ]

        now = datetime.now(timezone.utc)
        for pdata in properties_data:
            prop = Property(
                title=pdata["title"],
                slug=slugify(pdata["title"]),
                description=f"Premium {pdata['title']} available through Kigalifinders.",
                short_description=f"Beautiful property in {pdata.get('neighborhood', 'Kigali')}.",
                listing_type=pdata["listing_type"],
                status=PropertyStatusEnum.PUBLISHED,
                price=pdata["price"],
                price_period="month" if pdata["listing_type"] != ListingType.SALE else None,
                bedrooms=pdata.get("bedrooms"),
                bathrooms=pdata.get("bathrooms"),
                area_sqm=pdata.get("area_sqm"),
                lot_size_sqm=pdata.get("lot_size_sqm"),
                district_id=districts[pdata["district"]].id,
                neighborhood_id=neighborhoods.get(pdata.get("neighborhood", ""), list(neighborhoods.values())[0]).id
                if pdata.get("neighborhood") in neighborhoods else None,
                property_type_id=ptypes[pdata["ptype"]].id,
                is_featured=pdata.get("featured", False),
                is_premium=pdata.get("premium", False),
                is_furnished=pdata.get("furnished", False),
                has_title_deed=pdata.get("title_deed", False),
                badge_label=pdata.get("badge"),
                published_at=now,
            )
            db.add(prop)
            await db.flush()
            db.add(PropertyImage(property_id=prop.id, url=pdata["image"], is_primary=True, alt_text=pdata["title"]))

        testimonials = [
            (
                "Aline Mukamana",
                "Homeowner",
                "Nyarutarama",
                "Kigalifinders made finding our family home stress-free. Professional, responsive, and they truly understand the Kigali market.",
                "https://images.unsplash.com/photo-1589156191108-c762ff4b96ab?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
            ),
            (
                "James Carter",
                "Expat Tenant",
                "Kibagabaga",
                "As an expat moving to Kigali, I needed a partner I could trust. The team went above and beyond.",
                "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=96&h=96&fit=crop&crop=entropy&auto=format&q=80",
            ),
            (
                "Patrick Niyonzima",
                "Investor",
                "Kicukiro",
                "I bought a plot through Kigalifinders. Transparent process, all documents verified, and zero surprises.",
                "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
            ),
        ]
        for i, (name, role, loc, content, avatar) in enumerate(testimonials):
            db.add(
                Testimonial(
                    name=name,
                    role=role,
                    location=loc,
                    content=content,
                    avatar_url=avatar,
                    rating=5,
                    is_featured=True,
                    sort_order=i,
                )
            )

        faqs = [
            ("Where can I rent a house in Kigali?",
             "You can rent a house in any of Kigali's prime neighborhoods, including Nyarutarama, Kibagabaga, Kacyiru, Kicukiro, Rebero, and Gacuriro."),
            ("Which is the best real estate agency in Kigali?",
             "Kigalifinders is widely recognized as one of Rwanda's most trusted real estate agencies with 10+ years of experience."),
            ("How much does it cost to rent a furnished house in Kigali?",
             "Furnished houses in Kigali typically range from $800/month for a 2-bedroom apartment to $5,000+/month for a luxury villa."),
            ("Can I book a property viewing online?",
             "Yes — booking a property viewing with Kigalifinders is simple. Select your preferred date and time and we'll arrange the tour."),
        ]
        for i, (q, a) in enumerate(faqs):
            db.add(FAQ(question=q, answer=a, sort_order=i))

        cat = BlogCategory(name="Market Trends", slug="market-trends")
        db.add(cat)
        await db.flush()

        db.add(BlogPost(
            title="Kigali Rental Prices 2025: A Complete Guide",
            slug="kigali-rental-prices-2025",
            excerpt="Understand the current rental landscape across all Kigali districts.",
            content="## Kigali Rental Market\n\nThe rental market in Kigali continues to grow...",
            featured_image="https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800",
            category_id=cat.id,
            read_time_minutes=5,
            status="published",
            is_published=True,
            published_at=now,
        ))

        db.add(Setting(key="stats", value={"properties_listed": 1200, "happy_clients": 850, "years_experience": 10, "client_rating": 4.9}, group="site"))
        db.add(Setting(key="hero", value={
            "tagline": "RWANDA'S #1 LUXURY REAL ESTATE",
            "title": "Find Your Dream Home in Kigali",
            "subtitle": "Discover an exclusive collection of furnished houses, rental homes, and prime plots for sale across Kigali.",
            "background_image": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=2000",
            "cta_primary": "Book a Visit",
            "cta_secondary": "Browse Properties",
        }, group="homepage"))
        db.add(Setting(key="site", value={
            "phone": "+250 784 806 641",
            "whatsapp": "250784806641",
            "address": "KN 4 St, Kigali, Rwanda",
            "hours": "Mon - Sat: 8:00 AM - 7:00 PM",
            "booking_url": "https://secure-guard.setmore.com/",
            "email": "hello@kigalifinders.com",
            "latitude": -1.944072,
            "longitude": 30.058775,
        }, group="site"))
        db.add(Setting(key="links", value={
            "booking_url": "https://secure-guard.setmore.com/",
            "book_consultation_url": "https://secure-guard.setmore.com/",
            "phone": "+250 784 806 641",
            "whatsapp": "250784806641",
        }, group="site"))
        db.add(Setting(key="social", value={
            "facebook": "", "instagram": "", "twitter": "", "linkedin": "", "youtube": "",
        }, group="site"))
        from app.core.legal_defaults import DEFAULT_LEGAL

        db.add(Setting(key="legal", value=DEFAULT_LEGAL, group="site"))

        await db.commit()
        print("Database seeded successfully!")
        print("Admin login: admin@kigalifinders.com / Admin@123456")


if __name__ == "__main__":
    asyncio.run(seed())
