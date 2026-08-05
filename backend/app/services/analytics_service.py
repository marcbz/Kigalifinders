from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import Request
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Analytics, BlogPost, Property, PropertyStatusEnum

EVENT_PAGE_VIEW = "page_view"


def parse_device(user_agent: str | None) -> str:
    if not user_agent:
        return "Unknown"
    ua = user_agent.lower()
    if "ipad" in ua or "tablet" in ua:
        return "Tablet"
    if any(token in ua for token in ("mobile", "iphone", "android", "ipod")):
        return "Mobile"
    if any(token in ua for token in ("windows", "macintosh", "linux", "cros")):
        return "Desktop"
    return "Other"


def parse_traffic_source(referer: str | None) -> str:
    if not referer or not referer.strip():
        return "Direct"
    try:
        host = urlparse(referer).netloc.lower().replace("www.", "")
    except Exception:
        return "Other"
    if not host:
        return "Direct"
    if "google" in host:
        return "Google"
    if host in {"facebook.com", "fb.com", "m.facebook.com"}:
        return "Facebook"
    if "instagram" in host:
        return "Instagram"
    if host in {"t.co", "twitter.com", "x.com"}:
        return "X / Twitter"
    if "linkedin" in host:
        return "LinkedIn"
    if "youtube" in host:
        return "YouTube"
    if "bing" in host:
        return "Bing"
    if "kigalifinders" in host:
        return "Direct"
    return "Other"


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_page_view(
        self,
        entity_type: str,
        entity_id: str,
        request: Request | None = None,
        *,
        user_agent: str | None = None,
        referer: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        if request is not None:
            user_agent = user_agent or request.headers.get("user-agent")
            referer = referer or request.headers.get("referer")
            if request.client:
                ip_address = ip_address or request.client.host

        device = parse_device(user_agent)
        source = parse_traffic_source(referer)

        self.db.add(
            Analytics(
                event_type=EVENT_PAGE_VIEW,
                entity_type=entity_type,
                entity_id=entity_id,
                metadata_json={
                    "device": device,
                    "source": source,
                    "referer": (referer or "")[:500] or None,
                },
                ip_address=ip_address,
                user_agent=(user_agent or "")[:500] or None,
            )
        )
        await self.db.flush()

    async def get_report(self, days: int = 30) -> dict[str, Any]:
        days = max(7, min(days, 90))
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days - 1)
        start_date = start.date()

        daily_rows = await self.db.execute(
            select(
                cast(Analytics.created_at, Date).label("day"),
                Analytics.entity_type,
                func.count().label("count"),
            )
            .where(
                Analytics.event_type == EVENT_PAGE_VIEW,
                Analytics.created_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc),
            )
            .group_by("day", Analytics.entity_type)
            .order_by("day")
        )

        day_map: dict[date, dict[str, int]] = {}
        for row in daily_rows.all():
            day = row.day
            if day not in day_map:
                day_map[day] = {"property": 0, "blog": 0}
            if row.entity_type in day_map[day]:
                day_map[day][row.entity_type] = int(row.count)

        daily_views = []
        for offset in range(days):
            day = start_date + timedelta(days=offset)
            counts = day_map.get(day, {"property": 0, "blog": 0})
            property_views = counts["property"]
            blog_views = counts["blog"]
            daily_views.append(
                {
                    "date": day.isoformat(),
                    "property": property_views,
                    "blog": blog_views,
                    "total": property_views + blog_views,
                }
            )

        device_rows = await self.db.execute(
            select(
                Analytics.metadata_json["device"].astext.label("device"),
                func.count().label("count"),
            )
            .where(
                Analytics.event_type == EVENT_PAGE_VIEW,
                Analytics.created_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc),
            )
            .group_by("device")
        )
        devices = [
            {"name": row.device or "Unknown", "value": int(row.count)}
            for row in device_rows.all()
        ]
        devices.sort(key=lambda item: item["value"], reverse=True)

        source_rows = await self.db.execute(
            select(
                Analytics.metadata_json["source"].astext.label("source"),
                func.count().label("count"),
            )
            .where(
                Analytics.event_type == EVENT_PAGE_VIEW,
                Analytics.created_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc),
            )
            .group_by("source")
        )
        sources = [
            {"name": row.source or "Other", "value": int(row.count)}
            for row in source_rows.all()
        ]
        sources.sort(key=lambda item: item["value"], reverse=True)

        property_views_total = (await self.db.execute(select(func.sum(Property.views_count)))).scalar() or 0
        blog_views_total = (await self.db.execute(select(func.sum(BlogPost.views_count)))).scalar() or 0

        period_property = sum(day["property"] for day in daily_views)
        period_blog = sum(day["blog"] for day in daily_views)

        top_properties = await self.db.execute(
            select(Property.title, Property.slug, Property.views_count, Property.published_at)
            .where(Property.status == PropertyStatusEnum.PUBLISHED)
            .order_by(Property.views_count.desc())
            .limit(10)
        )
        top_blog = await self.db.execute(
            select(BlogPost.title, BlogPost.slug, BlogPost.views_count, BlogPost.published_at, BlogPost.created_at)
            .where(BlogPost.is_published == True)
            .order_by(BlogPost.views_count.desc())
            .limit(10)
        )

        return {
            "period_days": days,
            "daily_views": daily_views,
            "period_totals": {
                "property_views": period_property,
                "blog_views": period_blog,
                "total_views": period_property + period_blog,
            },
            "all_time_totals": {
                "property_views": int(property_views_total),
                "blog_views": int(blog_views_total),
                "total_views": int(property_views_total) + int(blog_views_total),
            },
            "devices": devices,
            "sources": sources,
            "top_properties": [
                {
                    "title": row.title,
                    "slug": row.slug,
                    "views_count": row.views_count,
                    "published_at": row.published_at.isoformat() if row.published_at else None,
                }
                for row in top_properties.all()
            ],
            "top_blog_posts": [
                {
                    "title": row.title,
                    "slug": row.slug,
                    "views_count": row.views_count,
                    "published_at": row.published_at.isoformat() if row.published_at else None,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
                for row in top_blog.all()
            ],
        }
