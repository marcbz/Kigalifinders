"""SEO landing-page attribute rules and dimension counting.

Allowed SEO attributes (only these):
furnished / unfurnished, bedrooms, bathrooms, kitchen, parking,
garden, swimming pool, compound.

Blocked from SEO/filter landing generation:
internet, staff quarters, security, balcony.

Location counts as one dimension. Example: Kibagabaga + furnished = 2.
Property type is a structural facet (apartment/house) and also counts as one dimension.
"""

from __future__ import annotations

from typing import Any

# Amenity slugs allowed on SEO landing queries (after normalization).
ALLOWED_SEO_AMENITIES = frozenset(
    {
        "swimming_pool",
        "parking",
        "garden",
        "kitchen",
        "compound",
    }
)

# Explicitly removed from SEO/filter landing system.
BLOCKED_SEO_AMENITIES = frozenset(
    {
        "internet",
        "wifi",
        "wi_fi",
        "staff_quarters",
        "staff-quarters",
        "staff",
        "security",
        "balcony",
        "balconies",
    }
)

# Aliases → canonical allowed slug
AMENITY_ALIASES = {
    "pool": "swimming_pool",
    "swimming-pool": "swimming_pool",
    "swiming_pool": "swimming_pool",
    "parking_space": "parking",
    "parking_spaces": "parking",
    "enclosed_compound": "compound",
    "gated_compound": "compound",
}


def normalize_amenity_slug(raw: str) -> str:
    s = str(raw or "").lower().strip().replace(" ", "_").replace("-", "_")
    return AMENITY_ALIASES.get(s, s)


def sanitize_seo_amenities(amenities: list[Any] | None) -> tuple[list[str], list[str]]:
    """Return (allowed_amenities, blocked_found)."""
    allowed: list[str] = []
    blocked: list[str] = []
    for a in amenities or []:
        slug = normalize_amenity_slug(str(a))
        if not slug:
            continue
        if slug in BLOCKED_SEO_AMENITIES:
            blocked.append(slug)
            continue
        if slug in ALLOWED_SEO_AMENITIES:
            allowed.append(slug)
        # Unknown amenities are ignored for SEO (not invented into landing pages)
    return sorted(set(allowed)), sorted(set(blocked))


def count_seo_dimensions(query: dict[str, Any]) -> int:
    """Count SEO dimensions. Location always counts as 1 when present."""
    dims = 0
    if query.get("location") or query.get("location_slug"):
        dims += 1
    if query.get("property_type") or query.get("property_type_slug"):
        dims += 1
    if query.get("bedrooms") is not None:
        dims += 1
    if query.get("bathrooms") is not None:
        dims += 1
    if query.get("furnished") is not None or query.get("is_furnished") is not None:
        dims += 1
    allowed, _ = sanitize_seo_amenities(query.get("amenities") or [])
    dims += len(allowed)
    # Price band is meaningful search intent (counts as one dimension max)
    if query.get("max_price_usd") is not None or query.get("min_price_usd") is not None:
        dims += 1
    return dims


def query_has_blocked_seo_attributes(query: dict[str, Any]) -> list[str]:
    _, blocked = sanitize_seo_amenities(query.get("amenities") or [])
    return blocked


def amenity_property_flags(amenities: list[str]) -> dict[str, bool]:
    """Map allowed amenity slugs to Property boolean columns where available."""
    flags: dict[str, bool] = {}
    for a in amenities:
        slug = normalize_amenity_slug(a)
        if slug == "swimming_pool":
            flags["has_pool"] = True
        elif slug == "parking":
            flags["has_parking"] = True
        elif slug == "garden":
            flags["has_garden"] = True
        elif slug == "kitchen":
            flags["has_kitchen"] = True
    return flags


# Admin Attributes tab — important rental facets for landing pages
SEO_ADMIN_ATTRIBUTES: list[dict[str, str]] = [
    {"key": "furnished", "label": "Furnished"},
    {"key": "unfurnished", "label": "Unfurnished"},
    {"key": "bedrooms", "label": "Bedrooms"},
    {"key": "bathrooms", "label": "Bathrooms"},
    {"key": "kitchen", "label": "Kitchen"},
    {"key": "parking", "label": "Parking"},
    {"key": "garden", "label": "Garden"},
    {"key": "swimming_pool", "label": "Swimming pool"},
    {"key": "compound", "label": "Compound"},
]


def intent_uses_attribute(query: dict[str, Any], attribute_key: str) -> bool:
    """Whether a search-intent query uses the given SEO attribute."""
    key = (attribute_key or "").strip().lower().replace(" ", "_").replace("-", "_")
    q = query or {}
    furnished = q.get("furnished")
    if furnished is None:
        furnished = q.get("is_furnished")

    if key == "furnished":
        return furnished is True
    if key == "unfurnished":
        return furnished is False
    if key == "bedrooms":
        return q.get("bedrooms") is not None
    if key == "bathrooms":
        return q.get("bathrooms") is not None

    amenity_key = "swimming_pool" if key in {"swimming_pool", "pool", "swimmingpool"} else key
    if amenity_key in ALLOWED_SEO_AMENITIES:
        allowed, _ = sanitize_seo_amenities(q.get("amenities") or [])
        return amenity_key in allowed
    return False


async def seo_attribute_admin_stats(db: Any) -> dict[str, Any]:
    """Property + eligible-page counts per SEO attribute for the admin Attributes tab."""
    from sqlalchemy import func, select

    from app.models import (
        Amenity,
        AutomaticEligibility,
        ListingType,
        Property,
        PropertyStatusEnum,
        SearchIntent,
        property_amenities,
    )

    rental_filter = (
        (Property.status == PropertyStatusEnum.PUBLISHED)
        & (Property.listing_type.in_([ListingType.RENT, ListingType.FURNISHED]))
    )

    async def _count_props(*extra) -> int:
        stmt = select(func.count()).select_from(Property).where(rental_filter, *extra)
        return int((await db.execute(stmt)).scalar() or 0)

    prop_counts = {
        "furnished": await _count_props(Property.is_furnished == True),  # noqa: E712
        "unfurnished": await _count_props(Property.is_furnished == False),  # noqa: E712
        "bedrooms": await _count_props(Property.bedrooms.is_not(None)),
        "bathrooms": await _count_props(Property.bathrooms.is_not(None)),
        "kitchen": await _count_props(Property.has_kitchen == True),  # noqa: E712
        "parking": await _count_props(Property.has_parking == True),  # noqa: E712
        "garden": await _count_props(Property.has_garden == True),  # noqa: E712
        "swimming_pool": await _count_props(Property.has_pool == True),  # noqa: E712
    }

    compound_count = await db.execute(
        select(func.count(func.distinct(Property.id)))
        .select_from(Property)
        .join(property_amenities, property_amenities.c.property_id == Property.id)
        .join(Amenity, Amenity.id == property_amenities.c.amenity_id)
        .where(rental_filter, Amenity.slug == "compound")
    )
    prop_counts["compound"] = int(compound_count.scalar() or 0)

    intents = list((await db.execute(select(SearchIntent))).scalars().all())
    items = []
    for spec in SEO_ADMIN_ATTRIBUTES:
        key = spec["key"]
        matching_pages = [i for i in intents if intent_uses_attribute(i.query or {}, key)]
        eligible_pages = [
            i
            for i in matching_pages
            if i.automatic_eligibility == AutomaticEligibility.ELIGIBLE.value
            or i.index_status == "indexable"
        ]
        items.append(
            {
                "key": key,
                "label": spec["label"],
                "matching_properties": prop_counts.get(key, 0),
                "eligible_pages": len(eligible_pages),
                "search_pages": len(matching_pages),
            }
        )

    return {"items": items}
