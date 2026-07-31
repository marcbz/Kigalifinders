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
