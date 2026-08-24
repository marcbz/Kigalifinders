"""Deterministic query normalization, slugs, copy, and fingerprints."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any


def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:180]


def normalize_query(query: dict[str, Any]) -> dict[str, Any]:
    location = (query.get("location") or query.get("location_slug") or "kigali").lower().strip()
    amenities = sorted(
        {
            str(a).lower().replace(" ", "_")
            for a in (query.get("amenities") or [])
            if a
        }
    )
    # Normalize pool aliases
    amenities = ["swimming_pool" if a in {"pool", "swimming_pool"} else a for a in amenities]
    amenities = sorted(set(amenities))
    out: dict[str, Any] = {"location": location, "currency": "USD"}
    ptype = query.get("property_type") or query.get("property_type_slug")
    if ptype:
        out["property_type"] = str(ptype).lower().strip()
    if query.get("bedrooms") is not None:
        out["bedrooms"] = int(query["bedrooms"])
    if query.get("furnished") is not None:
        out["furnished"] = bool(query["furnished"])
    elif query.get("is_furnished") is not None:
        out["furnished"] = bool(query["is_furnished"])
    if amenities:
        out["amenities"] = amenities
    if query.get("max_price_usd") is not None:
        out["max_price_usd"] = int(float(query["max_price_usd"]))
    if query.get("min_price_usd") is not None:
        out["min_price_usd"] = int(float(query["min_price_usd"]))
    return out


def canonical_query_hash(query: dict[str, Any]) -> str:
    norm = normalize_query(query)
    raw = json.dumps(norm, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:40]


def intent_slug_from_query(query: dict[str, Any]) -> str:
    q = normalize_query(query)
    parts: list[str] = []
    if q.get("bedrooms") is not None:
        parts.append(f"{q['bedrooms']}-bedroom")
    if q.get("furnished") is True:
        parts.append("furnished")
    elif q.get("furnished") is False:
        parts.append("unfurnished")
    ptype = q.get("property_type")
    if ptype:
        plural = ptype if ptype.endswith("s") else f"{ptype}s"
        if ptype == "apartment":
            plural = "apartments"
        elif ptype == "house":
            plural = "houses"
        parts.append(plural)
    else:
        parts.append("rentals")
    amenities = q.get("amenities") or []
    if "swimming_pool" in amenities:
        parts.append("with-pool")
    if q.get("max_price_usd") is not None:
        parts.append(f"under-{int(q['max_price_usd'])}")
    if q.get("min_price_usd") is not None and q.get("max_price_usd") is None:
        parts.append(f"from-{int(q['min_price_usd'])}")
    return _slugify("-".join(parts)) or "rentals"


def location_slug_from_query(query: dict[str, Any]) -> str:
    return normalize_query(query)["location"]


def generate_copy(query: dict[str, Any]) -> dict[str, str]:
    q = normalize_query(query)
    loc = q["location"].replace("-", " ").title()
    if q["location"] == "kigali":
        loc = "Kigali"

    bits: list[str] = []
    if q.get("bedrooms") is not None:
        bits.append(f"{q['bedrooms']}-Bedroom")
    if q.get("furnished") is True:
        bits.append("Furnished")
    elif q.get("furnished") is False:
        bits.append("Unfurnished")

    ptype = q.get("property_type")
    if ptype == "apartment":
        noun = "Apartments"
        noun_sing = "apartment"
    elif ptype == "house":
        noun = "Houses"
        noun_sing = "house"
    elif ptype:
        noun = ptype.replace("-", " ").title() + "s"
        noun_sing = ptype
    else:
        noun = "Rentals"
        noun_sing = "rental"

    bits.append(noun)
    core = " ".join(bits)

    amenity_bit = ""
    if "swimming_pool" in (q.get("amenities") or []):
        amenity_bit = " with Swimming Pool"

    price_bit = ""
    if q.get("max_price_usd") is not None:
        price_bit = f" Under ${int(q['max_price_usd']):,}"

    h1 = f"{core}{amenity_bit} for Rent in {loc}{price_bit}"
    title = f"{h1} | KigaliRent"
    desc = (
        f"Verified {noun_sing} listings for rent in {loc}"
        f"{amenity_bit.lower()}"
        f"{price_bit.lower()}/month. "
        f"See current availability, USD asking rents, and neighborhood context on KigaliRent."
    )
    return {
        "title": title[:255],
        "h1": h1[:255],
        "meta_description": desc[:500],
    }
