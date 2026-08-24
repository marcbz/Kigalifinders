"""Configurable thresholds for search-intent / SEO landing automation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IntentAutomationSetting

SETTINGS_KEY = "search_intent_thresholds"


@dataclass
class IntentAutomationConfig:
    # SEO landing gates (admin-editable)
    min_dimensions_for_index: int = 2
    min_verified_for_index: int = 5
    allow_auto_index: bool = True  # automatic SEO landing-page generation / promotion
    allow_sitemap_inclusion: bool = True
    require_unique_content: bool = True
    min_unique_content_chars: int = 40  # intro/meta uniqueness threshold when required

    # Discovery / draft (keep conservative — do not invent thousands of thin pages)
    min_verified_for_discover: int = 3
    min_verified_for_draft: int = 3
    min_observations_for_research_value: int = 5
    min_opportunity_for_draft: float = 35.0
    min_opportunity_for_index: float = 45.0
    min_quality_for_index: float = 40.0
    max_auto_indexable: int = 80
    max_discovered_per_run: int = 80
    freshness_fresh_days: int = 14
    freshness_aging_days: int = 45
    near_duplicate_price_band_gap: float = 250.0
    max_amenities_per_location: int = 2
    bedroom_levels: tuple[int, ...] = (1, 2, 3, 4)
    bathroom_levels: tuple[float, ...] = (1.0, 2.0, 3.0)


DEFAULT_CONFIG = IntentAutomationConfig()

SEO_SETTING_FIELDS = (
    "min_dimensions_for_index",
    "min_verified_for_index",
    "min_quality_for_index",
    "min_opportunity_for_index",
    "min_observations_for_research_value",
    "allow_auto_index",
    "allow_sitemap_inclusion",
    "require_unique_content",
    "min_unique_content_chars",
)

SEO_SETTING_HELP = {
    "min_dimensions_for_index": (
        "How many filters a page needs before it can be indexed. "
        "Location counts as 1. Example: Kibagabaga + furnished = 2."
    ),
    "min_verified_for_index": (
        "Minimum number of real published KigaliRent properties that must match the page. "
        "Pages below this stay usable as filters but are not SEO landings."
    ),
    "min_quality_for_index": (
        "Minimum quality score (0–100) required for automatic index eligibility."
    ),
    "min_opportunity_for_index": (
        "Minimum opportunity score (0–100) required for automatic index eligibility."
    ),
    "min_observations_for_research_value": (
        "Minimum external observation count for research-backed eligibility "
        "(or enough matching properties per the match threshold)."
    ),
    "allow_auto_index": (
        "When on, the system may automatically mark eligible pages as indexable. "
        "When off, pages stay draft/noindex until an admin approves them."
    ),
    "allow_sitemap_inclusion": (
        "When on, eligible indexable rental landings are added to the XML sitemap. "
        "When off, they are excluded from the sitemap even if indexable."
    ),
    "require_unique_content": (
        "When on, a page needs useful unique intro/meta text (or real market data) "
        "before it can become an SEO landing."
    ),
    "min_unique_content_chars": (
        "Minimum length of intro or meta description when unique-content checking is enabled."
    ),
}


async def load_automation_config(db: AsyncSession) -> IntentAutomationConfig:
    result = await db.execute(
        select(IntentAutomationSetting).where(IntentAutomationSetting.key == SETTINGS_KEY)
    )
    row = result.scalar_one_or_none()
    if not row or not isinstance(row.value, dict):
        return DEFAULT_CONFIG
    base = asdict(DEFAULT_CONFIG)
    data = {**base, **row.value}
    # First deploy of SEO dimension gates: adopt new SEO defaults if missing from stored JSON
    if "min_dimensions_for_index" not in row.value:
        for k in SEO_SETTING_FIELDS:
            data[k] = getattr(DEFAULT_CONFIG, k)
    if isinstance(data.get("bedroom_levels"), list):
        data["bedroom_levels"] = tuple(int(x) for x in data["bedroom_levels"])
    if isinstance(data.get("bathroom_levels"), list):
        data["bathroom_levels"] = tuple(float(x) for x in data["bathroom_levels"])
    return IntentAutomationConfig(**{k: data[k] for k in base.keys()})


async def save_automation_config(
    db: AsyncSession, cfg: IntentAutomationConfig | dict[str, Any]
) -> IntentAutomationConfig:
    if isinstance(cfg, dict):
        base = asdict(DEFAULT_CONFIG)
        merged = {**base, **cfg}
        if isinstance(merged.get("bedroom_levels"), list):
            merged["bedroom_levels"] = tuple(int(x) for x in merged["bedroom_levels"])
        if isinstance(merged.get("bathroom_levels"), list):
            merged["bathroom_levels"] = tuple(float(x) for x in merged["bathroom_levels"])
        cfg = IntentAutomationConfig(**{k: merged[k] for k in base.keys()})
    # Clamp sensible ranges
    cfg.min_dimensions_for_index = max(1, min(10, int(cfg.min_dimensions_for_index)))
    cfg.min_verified_for_index = max(1, min(100, int(cfg.min_verified_for_index)))
    cfg.min_unique_content_chars = max(0, min(2000, int(cfg.min_unique_content_chars)))
    cfg.min_quality_for_index = max(0.0, min(100.0, float(cfg.min_quality_for_index)))
    cfg.min_opportunity_for_index = max(0.0, min(100.0, float(cfg.min_opportunity_for_index)))
    cfg.min_observations_for_research_value = max(0, min(500, int(cfg.min_observations_for_research_value)))

    result = await db.execute(
        select(IntentAutomationSetting).where(IntentAutomationSetting.key == SETTINGS_KEY)
    )
    row = result.scalar_one_or_none()
    payload = asdict(cfg)
    payload["bedroom_levels"] = list(cfg.bedroom_levels)
    payload["bathroom_levels"] = list(cfg.bathroom_levels)
    if row:
        row.value = payload
    else:
        db.add(IntentAutomationSetting(key=SETTINGS_KEY, value=payload))
    await db.flush()
    return cfg


def seo_settings_public(cfg: IntentAutomationConfig) -> dict[str, Any]:
    return {
        "settings": {k: getattr(cfg, k) for k in SEO_SETTING_FIELDS},
        "defaults": {k: getattr(DEFAULT_CONFIG, k) for k in SEO_SETTING_FIELDS},
        "help": SEO_SETTING_HELP,
        "allowed_attributes": [
            "furnished / unfurnished",
            "bedrooms",
            "bathrooms",
            "kitchen",
            "parking",
            "garden",
            "swimming pool",
            "compound",
        ],
        "removed_attributes": ["internet", "staff quarters", "security", "balcony"],
        "notes": (
            "Location counts as one dimension. Complex filters still work for users when not indexable. "
            "Never fabricates properties or market data."
        ),
    }
