"""Notify IndexNow-enabled search engines (Bing, Yandex, Seznam, Naver…) of changed URLs."""

from __future__ import annotations

import logging
from collections.abc import Iterable
from urllib.parse import urlparse

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"


def site_url(path: str) -> str:
    base = settings.PUBLIC_SITE_URL.rstrip("/")
    return f"{base}/{path.lstrip('/')}"


def property_urls(*slugs: str | None) -> list[str]:
    """Listing page(s) plus the listing index, which changes whenever a listing does."""
    urls = [site_url(f"/properties/{s}") for s in dict.fromkeys(s for s in slugs if s)]
    return [*urls, site_url("/properties")]


async def submit_urls(urls: Iterable[str]) -> bool:
    url_list = list(dict.fromkeys(u for u in urls if u))
    if not url_list or not settings.INDEXNOW_ENABLED or not settings.is_production:
        return False
    host = urlparse(settings.PUBLIC_SITE_URL).netloc
    payload = {
        "host": host,
        "key": settings.INDEXNOW_KEY,
        "keyLocation": site_url(f"/{settings.INDEXNOW_KEY}.txt"),
        "urlList": url_list[:10000],
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(INDEXNOW_ENDPOINT, json=payload)
        # 200 = accepted, 202 = accepted pending key validation
        if res.status_code in (200, 202):
            return True
        logger.warning("IndexNow rejected %d URLs: HTTP %s %s", len(url_list), res.status_code, res.text[:200])
    except Exception:
        logger.warning("IndexNow submission failed", exc_info=True)
    return False
