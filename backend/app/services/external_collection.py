"""Deprecated. External observations are CSV/manual import only.

Use app.services.observations.import_observations_csv + refresh_research_after_import.
"""

from __future__ import annotations


async def enqueue_collection(*_args, **_kwargs):
    raise ValueError("Automated external collection is disabled. Use CSV import.")
