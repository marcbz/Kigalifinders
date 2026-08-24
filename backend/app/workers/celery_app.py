from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "kigalifinders",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


@celery_app.task
def send_email_task(to: str, subject: str, html: str):
    if settings.RESEND_API_KEY:
        import resend
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({"from": settings.EMAIL_FROM, "to": to, "subject": subject, "html": html})
    return {"status": "sent", "to": to}


@celery_app.task
def rebuild_market_research_task():
    """Nightly-style aggregate rebuild. Prefer run_daily_automation_task in production."""
    import asyncio

    from app.database.session import AsyncSessionLocal
    from app.services.research import rebuild_observation_snapshots, rebuild_verified_snapshots

    async def _run():
        async with AsyncSessionLocal() as db:
            v = await rebuild_verified_snapshots(db)
            o = await rebuild_observation_snapshots(db)
            await db.commit()
            return {"verified_snapshots": v, "observation_snapshots": o}

    return asyncio.run(_run())


@celery_app.task
def run_daily_automation_task():
    import asyncio

    from app.database.session import AsyncSessionLocal
    from app.services.intent_automation import run_daily_automation

    async def _run():
        async with AsyncSessionLocal() as db:
            return await run_daily_automation(db)

    return asyncio.run(_run())


@celery_app.task
def run_weekly_audit_task():
    import asyncio

    from app.database.session import AsyncSessionLocal
    from app.services.intent_automation import run_weekly_audit

    async def _run():
        async with AsyncSessionLocal() as db:
            return await run_weekly_audit(db)

    return asyncio.run(_run())


@celery_app.task
def refresh_intents_for_property_task(
    location_slug: str | None = None,
    bedrooms: int | None = None,
    property_type_slug: str | None = None,
):
    import asyncio

    from app.database.session import AsyncSessionLocal
    from app.services.intent_automation import refresh_intents_for_property_facets

    async def _run():
        async with AsyncSessionLocal() as db:
            n = await refresh_intents_for_property_facets(
                db,
                location_slug=location_slug,
                bedrooms=bedrooms,
                property_type_slug=property_type_slug,
            )
            await db.commit()
            return {"touched": n}

    return asyncio.run(_run())


@celery_app.task
def run_external_collection_task(run_id: str):
    """Deprecated: external observations are CSV-only. Kept as no-op for old queues."""
    return {"ok": False, "error": "Automated external collection is disabled. Use CSV import."}


celery_app.conf.beat_schedule = {
    "rebuild-market-research-daily": {
        "task": "app.workers.celery_app.rebuild_market_research_task",
        "schedule": 60 * 60 * 24,
    },
    "intent-automation-daily": {
        "task": "app.workers.celery_app.run_daily_automation_task",
        "schedule": 60 * 60 * 24,
    },
    "intent-automation-weekly": {
        "task": "app.workers.celery_app.run_weekly_audit_task",
        "schedule": 60 * 60 * 24 * 7,
    },
}
