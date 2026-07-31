"""Build Supabase DATABASE_URL from project ref and password."""
from urllib.parse import quote_plus

from app.core.config import settings


def build_supabase_urls(password: str) -> tuple[str, str]:
    """Construct async and sync URLs for Supabase pooler (session mode)."""
    ref = settings.SUPABASE_URL.replace("https://", "").replace(".supabase.co", "").strip("/")
    encoded = quote_plus(password)
    # Session pooler — works on IPv4, suitable for migrations/seeding
    host = f"aws-0-eu-central-1.pooler.supabase.com"
    async_url = f"postgresql+asyncpg://postgres.{ref}:{encoded}@{host}:5432/postgres"
    sync_url = f"postgresql://postgres.{ref}:{encoded}@{host}:5432/postgres"
    return async_url, sync_url


def apply_supabase_urls(password: str) -> None:
    async_url, sync_url = build_supabase_urls(password)
    settings.DATABASE_URL = async_url
    settings.DATABASE_URL_SYNC = sync_url
