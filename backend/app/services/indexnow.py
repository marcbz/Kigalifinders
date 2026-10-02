"""Notify IndexNow-enabled search engines (Bing, Yandex, Seznam, Naver…) of changed URLs.

Bing shares IndexNow submissions with Microsoft properties (Copilot, ChatGPT search via
Bing, DuckDuckGo/Yahoo/Ecosia results). Google does not participate; it reads sitemaps.
"""

from __future__ import annotations

import logging
import time
import xml.etree.ElementTree as ET
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
MAX_URLS_PER_REQUEST = 10000

RESEARCH_PATHS = [
    "/research/kigali-rental-market",
    "/research/kigali-rental-market/prices",
    "/research/kigali-rental-market/neighborhoods",
    "/research/kigali-rental-market/compare",
    "/research/kigali-rental-market/trends",
    "/research/kigali-rental-market/reports",
]
MAIN_PATHS = ["/", "/properties", "/rentals", "/rentals/kigali", "/area", "/blog"]

# Market data rebuilds after every listing save; research pages only need re-announcing occasionally.
RESEARCH_RESUBMIT_SECONDS = 6 * 3600
FULL_SWEEP_INTERVAL = timedelta(days=7)
FULL_SWEEP_SETTING_KEY = "indexnow_full_sweep"

_last_research_submit = 0.0


def site_url(path: str) -> str:
    base = settings.PUBLIC_SITE_URL.rstrip("/")
    return f"{base}/{path.lstrip('/')}"


def property_urls(*slugs: str | None) -> list[str]:
    """Listing page(s) plus the listing index, which changes whenever a listing does."""
    urls = [site_url(f"/properties/{s}") for s in dict.fromkeys(s for s in slugs if s)]
    return [*urls, site_url("/properties")]


def blog_urls(*slugs: str | None) -> list[str]:
    urls = [site_url(f"/blog/{s}") for s in dict.fromkeys(s for s in slugs if s)]
    return [*urls, site_url("/blog")]


def research_urls() -> list[str]:
    return [site_url(p) for p in [*RESEARCH_PATHS, *MAIN_PATHS]]


def _enabled() -> bool:
    return settings.INDEXNOW_ENABLED and settings.is_production


async def submit_urls(urls: Iterable[str]) -> bool:
    url_list = list(dict.fromkeys(u for u in urls if u))
    if not url_list or not _enabled():
        return False
    host = urlparse(settings.PUBLIC_SITE_URL).netloc
    ok = True
    async with httpx.AsyncClient(timeout=20.0) as client:
        for start in range(0, len(url_list), MAX_URLS_PER_REQUEST):
            batch = url_list[start : start + MAX_URLS_PER_REQUEST]
            payload = {
                "host": host,
                "key": settings.INDEXNOW_KEY,
                "keyLocation": site_url(f"/{settings.INDEXNOW_KEY}.txt"),
                "urlList": batch,
            }
            try:
                res = await client.post(INDEXNOW_ENDPOINT, json=payload)
                # 200 = accepted, 202 = accepted pending key validation
                if res.status_code not in (200, 202):
                    ok = False
                    logger.warning(
                        "IndexNow rejected %d URLs: HTTP %s %s", len(batch), res.status_code, res.text[:200]
                    )
            except Exception:
                ok = False
                logger.warning("IndexNow submission failed", exc_info=True)
    return ok


async def submit_research_pages(*, force: bool = False) -> bool:
    """Re-announce research hub + main pages after market data changes (throttled)."""
    global _last_research_submit
    now = time.monotonic()
    if not force and _last_research_submit and now - _last_research_submit < RESEARCH_RESUBMIT_SECONDS:
        return False
    _last_research_submit = now
    return await submit_urls(research_urls())


def _locs(xml_text: str) -> tuple[list[str], list[str]]:
    """Return (child sitemap URLs, page URLs) from a sitemap or sitemap index document."""
    root = ET.fromstring(xml_text)
    locs = [el.text.strip() for el in root.iter() if el.tag.endswith("loc") and (el.text or "").strip()]
    return (locs, []) if root.tag.endswith("sitemapindex") else ([], locs)


async def collect_sitemap_urls() -> list[str]:
    """Every page URL listed in the live sitemap (index + children), on our own host only."""
    host = urlparse(settings.PUBLIC_SITE_URL).netloc
    urls: list[str] = []
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        res = await client.get(site_url("/sitemap.xml"))
        res.raise_for_status()
        children, pages = _locs(res.text)
        urls.extend(pages)
        for child in children:
            try:
                child_res = await client.get(child)
                child_res.raise_for_status()
                urls.extend(_locs(child_res.text)[1])
            except Exception:
                logger.warning("Could not read child sitemap %s", child, exc_info=True)
    return [u for u in dict.fromkeys(urls) if urlparse(u).netloc == host]


async def submit_full_sitemap() -> dict[str, Any]:
    urls = await collect_sitemap_urls()
    ok = await submit_urls(urls) if urls else False
    return {"submitted": len(urls) if ok else 0, "found": len(urls), "ok": ok}


async def _record_sweep(db, result: dict[str, Any]) -> None:
    from sqlalchemy import select

    from app.models import Setting

    row = (await db.execute(select(Setting).where(Setting.key == FULL_SWEEP_SETTING_KEY))).scalar_one_or_none()
    value = {"last_run": datetime.now(timezone.utc).isoformat(), **result}
    if row:
        row.value = value
    else:
        db.add(Setting(key=FULL_SWEEP_SETTING_KEY, value=value, group="seo"))
    await db.commit()


async def last_full_sweep(db) -> dict[str, Any] | None:
    from sqlalchemy import select

    from app.models import Setting

    row = (await db.execute(select(Setting).where(Setting.key == FULL_SWEEP_SETTING_KEY))).scalar_one_or_none()
    return row.value if row else None


async def run_full_sweep(db) -> dict[str, Any]:
    result = await submit_full_sitemap()
    await _record_sweep(db, result)
    return result


async def run_scheduled_full_sweep() -> None:
    """Submit the whole sitemap at most once per FULL_SWEEP_INTERVAL (survives restarts via DB)."""
    if not _enabled():
        return
    from app.database.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            last = await last_full_sweep(db)
            last_run = datetime.fromisoformat(last["last_run"]) if last and last.get("last_run") else None
            if last_run and datetime.now(timezone.utc) - last_run < FULL_SWEEP_INTERVAL:
                return
            result = await run_full_sweep(db)
            logger.info("IndexNow weekly sweep: %s", result)
    except Exception:
        logger.warning("IndexNow scheduled sweep failed", exc_info=True)
