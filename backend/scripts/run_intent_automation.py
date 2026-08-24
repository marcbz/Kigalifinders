"""CLI entrypoints for search-intent / research automation.

Usage (from backend/):
  python scripts/run_intent_automation.py daily
  python scripts/run_intent_automation.py weekly
  python scripts/run_intent_automation.py discover
  python scripts/run_intent_automation.py seed-then-discover
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


async def _daily() -> None:
    from app.database.session import AsyncSessionLocal
    from app.services.intent_automation import run_daily_automation

    async with AsyncSessionLocal() as db:
        result = await run_daily_automation(db)
        print(result)


async def _weekly() -> None:
    from app.database.session import AsyncSessionLocal
    from app.services.intent_automation import run_weekly_audit

    async with AsyncSessionLocal() as db:
        result = await run_weekly_audit(db)
        print(result)


async def _discover() -> None:
    from app.database.session import AsyncSessionLocal
    from app.services.intent_automation import discover_intents

    async with AsyncSessionLocal() as db:
        result = await discover_intents(db, deep=True)
        await db.commit()
        print(result)


async def _seed_then_discover() -> None:
    from scripts.seed_search_intents import main as seed_main

    await seed_main()
    await _discover()
    await _daily()


def main() -> None:
    cmd = (sys.argv[1] if len(sys.argv) > 1 else "daily").lower()
    if cmd == "daily":
        asyncio.run(_daily())
    elif cmd == "weekly":
        asyncio.run(_weekly())
    elif cmd == "discover":
        asyncio.run(_discover())
    elif cmd == "seed-then-discover":
        asyncio.run(_seed_then_discover())
    else:
        print("Usage: daily | weekly | discover | seed-then-discover")
        sys.exit(1)


if __name__ == "__main__":
    main()
