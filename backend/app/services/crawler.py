"""Polite market-observation crawler scaffold.

Does NOT bypass CAPTCHA, login, paywalls, or anti-bot systems.
Respect robots.txt, rate limits, HTTP 429 / Retry-After.
Start disabled; enable one source after policy review.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger(__name__)


@dataclass
class CrawlerConfig:
    enabled: bool = False
    source_name: str = "example-source"
    base_url: str = ""
    user_agent: str = "KigaliRentResearchBot/1.0 (+https://kigalirent.com/research/kigali-rental-market/methodology/)"
    max_concurrency: int = 1
    min_delay_seconds: float = 5.0
    respect_robots: bool = True
    timeout_seconds: float = 20.0
    max_consecutive_errors: int = 3


@dataclass
class CrawlResult:
    fetched: int = 0
    skipped_robots: int = 0
    rate_limited: int = 0
    errors: list[str] = field(default_factory=list)
    listings: list[dict[str, Any]] = field(default_factory=list)
    paused: bool = False


class PoliteCrawler:
    def __init__(self, config: CrawlerConfig):
        self.config = config
        self._robots: RobotFileParser | None = None
        self._last_request_at: float | None = None
        self._consecutive_errors = 0

    async def _load_robots(self, client: httpx.AsyncClient) -> None:
        if not self.config.respect_robots or not self.config.base_url:
            return
        robots_url = f"{self.config.base_url.rstrip('/')}/robots.txt"
        rp = RobotFileParser()
        try:
            res = await client.get(robots_url)
            if res.status_code == 200:
                rp.parse(res.text.splitlines())
                self._robots = rp
            elif res.status_code == 429:
                self._consecutive_errors += 1
                logger.warning("robots.txt rate limited")
        except Exception as exc:  # noqa: BLE001
            logger.warning("robots.txt fetch failed: %s", exc)

    def _allowed(self, url: str) -> bool:
        if not self._robots:
            return True
        return self._robots.can_fetch(self.config.user_agent, url)

    async def _throttle(self) -> None:
        loop = asyncio.get_event_loop()
        now = loop.time()
        if self._last_request_at is not None:
            wait = self.config.min_delay_seconds - (now - self._last_request_at)
            if wait > 0:
                await asyncio.sleep(wait)
        self._last_request_at = loop.time()

    async def fetch_text(self, client: httpx.AsyncClient, url: str) -> tuple[int, str | None]:
        if not self._allowed(url):
            return 0, None
        await self._throttle()
        res = await client.get(url, headers={"User-Agent": self.config.user_agent})
        if res.status_code == 429:
            retry = res.headers.get("Retry-After")
            delay = float(retry) if retry and retry.isdigit() else self.config.min_delay_seconds * 3
            await asyncio.sleep(delay)
            self._consecutive_errors += 1
            return 429, None
        if res.status_code >= 400:
            self._consecutive_errors += 1
            return res.status_code, None
        self._consecutive_errors = 0
        return res.status_code, res.text

    async def run_sample(self, seed_urls: list[str] | None = None) -> CrawlResult:
        """Fetch seed URLs only — no HTML parsing of competitor content into full listings.

        Returns metadata stubs for operators to review. Prefer CSV import until a
        listing adapter is explicitly approved for the source.
        """
        result = CrawlResult()
        if not self.config.enabled:
            result.errors.append("Crawler disabled. Enable only after policy review for one source.")
            return result
        if not self.config.base_url:
            result.errors.append("base_url required")
            return result

        urls = seed_urls or [self.config.base_url]
        async with httpx.AsyncClient(timeout=self.config.timeout_seconds, follow_redirects=True) as client:
            await self._load_robots(client)
            for url in urls:
                if self._consecutive_errors >= self.config.max_consecutive_errors:
                    result.paused = True
                    result.errors.append("Paused after repeated errors or HTTP 429")
                    break
                if not self._allowed(url):
                    result.skipped_robots += 1
                    continue
                try:
                    status, text = await self.fetch_text(client, url)
                    if status == 429:
                        result.rate_limited += 1
                        result.paused = True
                        result.errors.append(f"HTTP 429 for {url} — stopping")
                        break
                    if text is None:
                        result.errors.append(f"Failed {url} status={status}")
                        continue
                    result.fetched += 1
                    # Intentionally do not store page HTML, images, descriptions, or contacts.
                    # Do not invent asking prices — listing adapters must supply structured fields.
                    result.listings.append(
                        {
                            "source": self.config.source_name,
                            "source_url": url,
                            "fetched_at": datetime.now(timezone.utc).isoformat(),
                            "bytes": len(text.encode("utf-8")),
                            "host": urlparse(url).netloc,
                            "note": "Raw HTML not stored. Use approved parsers or CSV import.",
                        }
                    )
                except Exception as exc:  # noqa: BLE001
                    self._consecutive_errors += 1
                    result.errors.append(str(exc))
        return result
