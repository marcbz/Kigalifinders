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
    """Nightly-style aggregate rebuild. Trigger via Beat or Render cron hitting admin API."""
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


celery_app.conf.beat_schedule = {
    "rebuild-market-research-daily": {
        "task": "app.workers.celery_app.rebuild_market_research_task",
        "schedule": 60 * 60 * 24,
    },
}
