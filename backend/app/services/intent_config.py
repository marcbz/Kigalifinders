"""Configurable thresholds for search-intent automation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IntentAutomationSetting

SETTINGS_KEY = "search_intent_thresholds"


@dataclass
class IntentAutomationConfig:
    min_verified_for_discover: int = 1
    min_verified_for_draft: int = 1
    min_verified_for_index: int = 2
    min_observations_for_research_value: int = 5
    min_opportunity_for_draft: float = 35.0
    min_opportunity_for_index: float = 55.0
    min_quality_for_index: float = 50.0
    max_auto_indexable: int = 80
    max_discovered_per_run: int = 120
    freshness_fresh_days: int = 14
    freshness_aging_days: int = 45
    near_duplicate_price_band_gap: float = 250.0
    # Candidate generation limits (anti thin-page)
    max_amenities_per_location: int = 1
    bedroom_levels: tuple[int, ...] = (1, 2, 3, 4)
    allow_auto_index: bool = True


DEFAULT_CONFIG = IntentAutomationConfig()


async def load_automation_config(db: AsyncSession) -> IntentAutomationConfig:
    result = await db.execute(
        select(IntentAutomationSetting).where(IntentAutomationSetting.key == SETTINGS_KEY)
    )
    row = result.scalar_one_or_none()
    if not row or not isinstance(row.value, dict):
        return DEFAULT_CONFIG
    base = asdict(DEFAULT_CONFIG)
    data = {**base, **row.value}
    # tuple fields
    if isinstance(data.get("bedroom_levels"), list):
        data["bedroom_levels"] = tuple(int(x) for x in data["bedroom_levels"])
    return IntentAutomationConfig(**{k: data[k] for k in base.keys()})


async def save_automation_config(db: AsyncSession, cfg: IntentAutomationConfig | dict[str, Any]) -> IntentAutomationConfig:
    if isinstance(cfg, dict):
        base = asdict(DEFAULT_CONFIG)
        merged = {**base, **cfg}
        if isinstance(merged.get("bedroom_levels"), list):
            merged["bedroom_levels"] = tuple(int(x) for x in merged["bedroom_levels"])
        cfg = IntentAutomationConfig(**{k: merged[k] for k in base.keys()})
    result = await db.execute(
        select(IntentAutomationSetting).where(IntentAutomationSetting.key == SETTINGS_KEY)
    )
    row = result.scalar_one_or_none()
    payload = asdict(cfg)
    payload["bedroom_levels"] = list(cfg.bedroom_levels)
    if row:
        row.value = payload
    else:
        db.add(IntentAutomationSetting(key=SETTINGS_KEY, value=payload))
    await db.flush()
    return cfg
