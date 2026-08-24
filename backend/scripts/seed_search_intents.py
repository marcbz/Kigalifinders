"""Seed curated high-value rental search intents (not combinatorial)."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models import SearchIndexStatus, SearchIntent
from app.services.search_intent import build_path, rebuild_intent_metrics

# Curated intents only — quality over quantity.
SEED_INTENTS = [
    {
        "location_slug": "kibagabaga",
        "intent_slug": "apartments-for-rent",
        "query": {"location": "kibagabaga", "property_type": "apartment"},
        "title": "Apartments for Rent in Kibagabaga | KigaliRent",
        "h1": "Apartments for Rent in Kibagabaga",
        "meta_description": "Browse verified apartments for rent in Kibagabaga, Kigali. See current availability, prices in USD, and neighborhood context.",
    },
    {
        "location_slug": "kibagabaga",
        "intent_slug": "4-bedroom-furnished-apartments",
        "query": {
            "location": "kibagabaga",
            "property_type": "apartment",
            "bedrooms": 4,
            "furnished": True,
        },
        "title": "4 Bedroom Furnished Apartments for Rent in Kibagabaga | KigaliRent",
        "h1": "4-Bedroom Furnished Apartments for Rent in Kibagabaga",
        "meta_description": "Verified 4-bedroom furnished apartments in Kibagabaga with current asking rents in USD.",
    },
    {
        "location_slug": "kibagabaga",
        "intent_slug": "furnished-apartments-with-pool",
        "query": {
            "location": "kibagabaga",
            "property_type": "apartment",
            "furnished": True,
            "amenities": ["swimming_pool"],
        },
        "title": "Furnished Apartments with Pool in Kibagabaga | KigaliRent",
        "h1": "Furnished Apartments with Swimming Pool in Kibagabaga",
        "meta_description": "Find furnished Kibagabaga apartments with a swimming pool — verified KigaliRent inventory.",
    },
    {
        "location_slug": "kibagabaga",
        "intent_slug": "4-bedroom-furnished-apartments-under-1500",
        "query": {
            "location": "kibagabaga",
            "property_type": "apartment",
            "bedrooms": 4,
            "furnished": True,
            "max_price_usd": 1500,
        },
        "title": "4 Bedroom Furnished Apartments in Kibagabaga Under $1,500 | KigaliRent",
        "h1": "4-Bedroom Furnished Apartments for Rent in Kibagabaga Under $1,500",
        "meta_description": "Verified 4-bedroom furnished apartments in Kibagabaga at or below $1,500/month.",
    },
    {
        "location_slug": "nyarutarama",
        "intent_slug": "3-bedroom-houses",
        "query": {"location": "nyarutarama", "property_type": "house", "bedrooms": 3},
        "title": "3 Bedroom Houses for Rent in Nyarutarama | KigaliRent",
        "h1": "3-Bedroom Houses for Rent in Nyarutarama",
        "meta_description": "Verified 3-bedroom houses for rent in Nyarutarama, Kigali.",
    },
    {
        "location_slug": "kacyiru",
        "intent_slug": "2-bedroom-apartments-under-800",
        "query": {
            "location": "kacyiru",
            "property_type": "apartment",
            "bedrooms": 2,
            "max_price_usd": 800,
        },
        "title": "2 Bedroom Apartments in Kacyiru Under $800 | KigaliRent",
        "h1": "2-Bedroom Apartments for Rent in Kacyiru Under $800",
        "meta_description": "Verified 2-bedroom apartments in Kacyiru priced at or below $800/month.",
    },
    {
        "location_slug": "kimihurura",
        "intent_slug": "furnished-houses",
        "query": {"location": "kimihurura", "property_type": "house", "furnished": True},
        "title": "Furnished Houses for Rent in Kimihurura | KigaliRent",
        "h1": "Furnished Houses for Rent in Kimihurura",
        "meta_description": "Verified furnished houses for rent in Kimihurura, Kigali.",
    },
    {
        "location_slug": "kigali",
        "intent_slug": "furnished-apartments",
        "query": {"location": "kigali", "property_type": "apartment", "furnished": True},
        "title": "Furnished Apartments for Rent in Kigali | KigaliRent",
        "h1": "Furnished Apartments for Rent in Kigali",
        "meta_description": "Browse verified furnished apartments across Kigali with USD pricing.",
    },
    {
        "location_slug": "kigali",
        "intent_slug": "apartments-with-swimming-pool",
        "query": {"location": "kigali", "property_type": "apartment", "amenities": ["swimming_pool"]},
        "title": "Apartments with Swimming Pool in Kigali | KigaliRent",
        "h1": "Apartments with Swimming Pool for Rent in Kigali",
        "meta_description": "Verified Kigali apartments that include a swimming pool.",
    },
    {
        "location_slug": "kigali",
        "intent_slug": "houses-under-1500",
        "query": {"location": "kigali", "property_type": "house", "max_price_usd": 1500},
        "title": "Houses for Rent in Kigali Under $1,500 | KigaliRent",
        "h1": "Houses for Rent in Kigali Under $1,500",
        "meta_description": "Verified houses for rent in Kigali at or below $1,500/month.",
    },
    {
        "location_slug": "kigali",
        "intent_slug": "3-bedroom-houses-under-1500",
        "query": {
            "location": "kigali",
            "property_type": "house",
            "bedrooms": 3,
            "max_price_usd": 1500,
        },
        "title": "3 Bedroom Houses in Kigali Under $1,500 | KigaliRent",
        "h1": "3-Bedroom Houses for Rent in Kigali Under $1,500",
        "meta_description": "Verified 3-bedroom houses in Kigali under $1,500/month.",
    },
    {
        "location_slug": "remera",
        "intent_slug": "apartments-for-rent",
        "query": {"location": "remera", "property_type": "apartment"},
        "title": "Apartments for Rent in Remera | KigaliRent",
        "h1": "Apartments for Rent in Remera",
        "meta_description": "Verified apartments for rent in Remera, Kigali.",
    },
    {
        "location_slug": "gacuriro",
        "intent_slug": "houses-for-rent",
        "query": {"location": "gacuriro", "property_type": "house"},
        "title": "Houses for Rent in Gacuriro | KigaliRent",
        "h1": "Houses for Rent in Gacuriro",
        "meta_description": "Verified houses for rent in Gacuriro, Kigali.",
    },
    {
        "location_slug": "kiyovu",
        "intent_slug": "apartments-for-rent",
        "query": {"location": "kiyovu", "property_type": "apartment"},
        "title": "Apartments for Rent in Kiyovu | KigaliRent",
        "h1": "Apartments for Rent in Kiyovu",
        "meta_description": "Verified apartments for rent in Kiyovu, Kigali.",
    },
]


async def main() -> None:
    async with AsyncSessionLocal() as db:
        created = 0
        for item in SEED_INTENTS:
            path = build_path(item["location_slug"], item["intent_slug"])
            existing = await db.execute(select(SearchIntent).where(SearchIntent.path == path))
            if existing.scalar_one_or_none():
                continue
            intent = SearchIntent(
                location_slug=item["location_slug"],
                intent_slug=item["intent_slug"],
                path=path,
                query=item["query"],
                title=item["title"],
                h1=item["h1"],
                meta_description=item.get("meta_description"),
                index_status=SearchIndexStatus.NOINDEX.value,
                is_enabled=True,
            )
            db.add(intent)
            await db.flush()
            await rebuild_intent_metrics(db, intent)
            # Promote strong pages to indexable after seed metrics
            if intent.match_count >= 1 and intent.quality_score >= 40:
                intent.index_status = SearchIndexStatus.INDEXABLE.value
            created += 1
        await db.commit()
        print(f"Seeded {created} search intents")


if __name__ == "__main__":
    asyncio.run(main())
