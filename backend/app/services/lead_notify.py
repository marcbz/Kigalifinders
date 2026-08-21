"""Lightweight lead notifications via CallMeBot WhatsApp or a webhook URL.

Setup (pick one):
1) CallMeBot (free): https://www.callmebot.com/blog/free-api-whatsapp-messages/
   Set WHATSAPP_CALLMEBOT_APIKEY and use the site WhatsApp number.
2) Any Make/Zapier/n8n webhook: set LEAD_NOTIFY_WEBHOOK_URL
"""

from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import quote

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Setting

logger = logging.getLogger(__name__)


async def _site_whatsapp(db: AsyncSession) -> Optional[str]:
    result = await db.execute(select(Setting).where(Setting.key.in_(["site", "links"])))
    rows = {row.key: row.value or {} for row in result.scalars().all()}
    links = rows.get("links") or {}
    site = rows.get("site") or {}
    raw = str(links.get("whatsapp") or site.get("whatsapp") or "").strip()
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    return digits or None


async def notify_lead_whatsapp(db: AsyncSession, message: str) -> None:
    """Best-effort WhatsApp/webhook notify — never raises to callers."""
    try:
        phone = await _site_whatsapp(db)
        apikey = getattr(settings, "WHATSAPP_CALLMEBOT_APIKEY", "") or ""
        webhook = getattr(settings, "LEAD_NOTIFY_WEBHOOK_URL", "") or ""

        async with httpx.AsyncClient(timeout=8.0) as client:
            if phone and apikey:
                url = (
                    "https://api.callmebot.com/whatsapp.php"
                    f"?phone={phone}&text={quote(message)}&apikey={apikey}"
                )
                await client.get(url)
                return

            if webhook:
                await client.post(webhook, json={"text": message, "phone": phone})
                return

        logger.info("Lead notify skipped (no CallMeBot key or webhook configured): %s", message[:120])
    except Exception:
        logger.exception("Lead WhatsApp notify failed")
