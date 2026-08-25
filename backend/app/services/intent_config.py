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
    # Primary SEO gate: meaningful search-filter count (admin: "Minimum search filters")
    min_dimensions_for_index: int = 3
    max_dimensions_for_index: int = 5  # >5 filters = weak / thin combos
    min_quality_for_index: float = 50.0
    max_sitemap_urls: int = 100
    # Minimum matching KigaliRent listings (always enforced when > 0)
    min_verified_for_index: int = 1
    # Minimum intent strength: weak | useful | strong (always enforced)
    min_intent_strength: str = "useful"
    # Legacy optional flags (kept for stored JSON compatibility)
    require_min_intent: bool = True
    min_intent_for_index: float = 45.0
    require_min_properties: bool = True
    allow_auto_index: bool = True
    allow_sitemap_inclusion: bool = True
    require_unique_content: bool = True
    min_unique_content_chars: int = 40  # ranking completeness, not a hard READY gate

    # Discovery / draft (keep conservative — do not invent thousands of thin pages)
    min_verified_for_discover: int = 3
    min_verified_for_draft: int = 3
    min_observations_for_research_value: int = 5  # ranking / research signal
    min_opportunity_for_draft: float = 35.0
    min_opportunity_for_index: float = 45.0  # ranking signal for sitemap priority
    max_auto_indexable: int = 500  # published pages cap (sitemap is capped separately)
    max_discovered_per_run: int = 80
    freshness_fresh_days: int = 14
    freshness_aging_days: int = 45
    near_duplicate_price_band_gap: float = 250.0
    max_amenities_per_location: int = 2
    bedroom_levels: tuple[int, ...] = (1, 2, 3, 4)
    bathroom_levels: tuple[float, ...] = (1.0, 2.0, 3.0)


DEFAULT_CONFIG = IntentAutomationConfig()

INTENT_STRENGTH_LEVELS = ("weak", "useful", "strong")
INTENT_STRENGTH_RANK = {"weak": 0, "useful": 2, "strong": 3}

SEO_SETTING_FIELDS = (
    "min_dimensions_for_index",
    "max_dimensions_for_index",
    "min_quality_for_index",
    "min_verified_for_index",
    "max_sitemap_urls",
    "min_intent_strength",
)

SEO_SETTING_HELP = {
    "min_dimensions_for_index": (
        "Minimum meaningful search filters for eligibility."
    ),
    "max_dimensions_for_index": (
        "Maximum meaningful search filters for eligibility. Over-specific combos are weak."
    ),
    "min_quality_for_index": (
        "Minimum quality score (0–100) required for automatic eligibility."
    ),
    "min_verified_for_index": (
        "Minimum matching KigaliRent property listings required for eligibility."
    ),
    "max_sitemap_urls": (
        "Hard global cap: maximum rental search URLs in sitemap-rentals.xml. "
        "Only the top ranked eligible pages are included."
    ),
    "min_intent_strength": (
        "Minimum search-intent strength: weak, useful, or strong."
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
    if "min_dimensions_for_index" not in row.value:
        for k in SEO_SETTING_FIELDS:
            if k in base:
                data[k] = getattr(DEFAULT_CONFIG, k)
    if "max_sitemap_urls" not in row.value:
        data["max_sitemap_urls"] = DEFAULT_CONFIG.max_sitemap_urls
        if row.value.get("min_quality_for_index") in (None, 40, 40.0):
            data["min_quality_for_index"] = DEFAULT_CONFIG.min_quality_for_index
    # Legacy → always-on properties gate
    if "require_min_properties" not in row.value and int(row.value.get("min_verified_for_index") or 0) > 0:
        data["require_min_properties"] = True
    data["require_min_properties"] = True
    # Legacy intent score toggle → strength level
    raw_strength = str(data.get("min_intent_strength") or "").strip().lower()
    if raw_strength not in INTENT_STRENGTH_LEVELS:
        if row.value.get("require_min_intent") is False:
            data["min_intent_strength"] = "weak"
        else:
            data["min_intent_strength"] = DEFAULT_CONFIG.min_intent_strength
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
    cfg.min_dimensions_for_index = max(1, min(10, int(cfg.min_dimensions_for_index)))
    cfg.max_dimensions_for_index = max(cfg.min_dimensions_for_index, min(12, int(cfg.max_dimensions_for_index)))
    cfg.min_verified_for_index = max(0, min(100, int(cfg.min_verified_for_index)))
    strength = str(cfg.min_intent_strength or "useful").strip().lower()
    if strength not in INTENT_STRENGTH_LEVELS:
        strength = "useful"
    cfg.min_intent_strength = strength
    cfg.require_min_intent = strength != "weak"
    cfg.require_min_properties = True
    cfg.min_intent_for_index = max(0.0, min(100.0, float(cfg.min_intent_for_index)))
    cfg.min_unique_content_chars = max(0, min(2000, int(cfg.min_unique_content_chars)))
    cfg.min_quality_for_index = max(0.0, min(100.0, float(cfg.min_quality_for_index)))
    cfg.max_sitemap_urls = max(1, min(5000, int(cfg.max_sitemap_urls)))
    cfg.min_opportunity_for_index = max(0.0, min(100.0, float(cfg.min_opportunity_for_index)))
    cfg.min_observations_for_research_value = max(0, min(500, int(cfg.min_observations_for_research_value)))
    cfg.max_auto_indexable = max(1, min(5000, int(cfg.max_auto_indexable)))

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
        "primary_criterion": "search_filters",
        "labels": {
            "min_dimensions_for_index": "Minimum search filters",
            "max_dimensions_for_index": "Maximum search filters",
            "min_quality_for_index": "Minimum quality (%)",
            "min_verified_for_index": "Minimum Properties Listing Number",
            "max_sitemap_urls": "Maximum indexed / sitemap URLs",
            "min_intent_strength": "Require minimum Intent",
        },
        "intent_strength_options": list(INTENT_STRENGTH_LEVELS),
        "search_intent_rules": {
            "strong": [
                "Neighborhood + Bedrooms + Property Type + Budget",
                "Neighborhood + Bedrooms + Property Type + Furnished/Unfurnished",
            ],
            "useful": "Any valid combination with 3–5 parameters",
            "weak": "Fewer than 3 parameters, or more than 5 parameters",
        },
        "notes": (
            "Eligibility uses filters, quality, property listings, and minimum intent strength. "
            "Sitemap includes at most the configured maximum URLs, ranked by intent strength, "
            "listings, quality, freshness, then uniqueness."
        ),
    }
