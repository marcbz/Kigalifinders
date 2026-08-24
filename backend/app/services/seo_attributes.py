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
