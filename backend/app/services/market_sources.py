"""Registry of external market observation sources.

Crawlers stay disabled until each source is explicitly approved after
robots.txt + terms review. Default ingest path: CSV/manual import.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


@dataclass(frozen=True)
class MarketSource:
    id: str
    name: str
    base_url: str
    robots_url: str
    crawl_allowed_default: bool
    preferred_ingest: str  # csv | crawler | both
    notes: str
    stores: str = "structured fields only — no competitor images, full descriptions, or contacts"


SOURCES: list[MarketSource] = [
    MarketSource(
        id="house_in_rwanda",
        name="House in Rwanda",
        base_url="https://www.houseinrwanda.com",
        robots_url="https://www.houseinrwanda.com/robots.txt",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes=(
            "robots.txt (reviewed 2026-08-24) disallows /admin/, /search/, auth paths; "
            "does not blanket-disallow listing pages. Still: no CAPTCHA/login bypass; "
            "low concurrency; prefer CSV until terms/policy sign-off."
        ),
    ),
    MarketSource(
        id="kigali_property",
        name="Kigali Property",
        base_url="https://www.kigaliproperty.com",
        robots_url="https://www.kigaliproperty.com/robots.txt",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes="Use CSV/manual import until robots/terms reviewed and crawl explicitly enabled.",
    ),
    MarketSource(
        id="kigali_list",
        name="Kigali List",
        base_url="https://kigalilist.com",
        robots_url="https://kigalilist.com/robots.txt",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes="Use CSV/manual import until robots/terms reviewed and crawl explicitly enabled.",
    ),
    MarketSource(
        id="vibe_rw",
        name="Vibe Real Estate",
        base_url="https://vibe.rw",
        robots_url="https://vibe.rw/robots.txt",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes="Use CSV/manual import until robots/terms reviewed and crawl explicitly enabled.",
    ),
    MarketSource(
        id="manual_other",
        name="Other permitted public source",
        base_url="",
        robots_url="",
        crawl_allowed_default=False,
        preferred_ingest="csv",
        notes="Operator-supplied CSV with source attribution and URL required.",
    ),
]


def list_sources() -> list[dict[str, Any]]:
    return [asdict(s) for s in SOURCES]


def get_source(source_id: str) -> MarketSource | None:
    for s in SOURCES:
        if s.id == source_id:
            return s
    return None
