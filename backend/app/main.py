import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)


async def _indexnow_scheduler() -> None:
    from app.services.indexnow import run_scheduled_full_sweep

    # Let the app (and the frontend sitemap that calls back into it) warm up first.
    await asyncio.sleep(120)
    while True:
        await run_scheduled_full_sweep()
        await asyncio.sleep(6 * 3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_indexnow_scheduler()) if settings.is_production else None
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title=settings.APP_NAME,
    description="Kigalifinders Real Estate Management Platform API",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=None if settings.is_production else f"{settings.API_V1_PREFIX}/docs",
    redoc_url=None if settings.is_production else f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health():
    return {"status": "healthy", "app": settings.APP_NAME}
