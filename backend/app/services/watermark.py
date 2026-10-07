"""Burn a KigaliRent watermark into listing photos.

The website only ever receives the watermarked copy. The clean original is stored privately
(Cloudinary `type=authenticated`, or a private S3 object) so photos can be re-processed later,
and `image_watermarks` records which public URLs are watermarked.
"""

from __future__ import annotations

import asyncio
import io
import ipaddress
import socket
import uuid
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import httpx
from PIL import Image, ImageOps
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import ImageWatermark
from app.services.media_upload import MAX_IMAGE_BYTES, _validate_image

LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "watermark-logo.png"
PUBLIC_FOLDER = "kigalifinders/properties"
ORIGINALS_FOLDER = "kigalifinders/originals"
MAX_EDGE = 2000
JPEG_QUALITY = 82
LOGO_WIDTH_RATIO = 0.55
LOGO_WIDTH_RATIO_PORTRAIT = 0.75
LOGO_OPACITY = 0.6
CONCURRENCY = 4


@lru_cache(maxsize=1)
def _logo() -> Image.Image:
    with Image.open(LOGO_PATH) as im:
        logo = im.convert("RGBA")
    logo.putalpha(logo.getchannel("A").point(lambda a: int(a * LOGO_OPACITY)))
    return logo


@lru_cache(maxsize=16)
def _logo_at(width: int) -> Image.Image:
    logo = _logo()
    height = max(1, round(logo.height * width / logo.width))
    return logo.resize((width, height), Image.Resampling.LANCZOS)


def apply_watermark(data: bytes) -> bytes:
    """Return JPEG bytes with the semi-transparent KigaliRent logo centered on the photo."""
    with Image.open(io.BytesIO(data)) as src:
        img = ImageOps.exif_transpose(src).convert("RGB")
    if max(img.size) > MAX_EDGE:
        img.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
    w, h = img.size

    # Bucket widths so the resized logo is reused across photos of similar size.
    ratio = LOGO_WIDTH_RATIO_PORTRAIT if h > w * 1.1 else LOGO_WIDTH_RATIO
    mark_w = max(80, int(w * ratio) // 20 * 20)
    mark = _logo_at(mark_w)
    img.paste(mark, ((w - mark.width) // 2, (h - mark.height) // 2), mark)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return buf.getvalue()


# --- storage -------------------------------------------------------------------------------


def _cloudinary_ready() -> bool:
    return bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)


def _s3_ready() -> bool:
    return bool(settings.AWS_S3_BUCKET and settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY)


def storage_configured() -> bool:
    return _cloudinary_ready() or _s3_ready()


def _cloudinary():
    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    return cloudinary.uploader


def _s3():
    import boto3

    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


def _store_original(data: bytes) -> tuple[str, str]:
    """Private copy of the clean photo. Returns (storage, key)."""
    if _cloudinary_ready():
        result = _cloudinary().upload(data, folder=ORIGINALS_FOLDER, resource_type="image", type="authenticated")
        return "cloudinary", result["public_id"]
    key = f"{ORIGINALS_FOLDER}/{uuid.uuid4()}"
    _s3().put_object(Bucket=settings.AWS_S3_BUCKET, Key=key, Body=data, ACL="private")
    return "s3", key


def _store_public(data: bytes) -> str:
    if _cloudinary_ready():
        result = _cloudinary().upload(data, folder=PUBLIC_FOLDER, resource_type="image")
        return result["secure_url"]
    key = f"{PUBLIC_FOLDER}/{uuid.uuid4()}.jpg"
    _s3().put_object(Bucket=settings.AWS_S3_BUCKET, Key=key, Body=data, ContentType="image/jpeg")
    return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


def _process(data: bytes) -> tuple[str, str, str]:
    marked = apply_watermark(data)
    storage, key = _store_original(data)
    return _store_public(marked), storage, key


async def _render_and_store(data: bytes, mime_type: str | None) -> tuple[str, str, str]:
    if not storage_configured():
        raise ValueError("Image upload is not configured. Set Cloudinary or AWS S3 credentials on the server.")
    _validate_image(data, mime_type)
    try:
        return await asyncio.to_thread(_process, data)
    except ValueError:
        raise
    except Exception as exc:
        if "cloud_name" in str(exc):
            raise ValueError(
                f"Cloudinary rejected the server's CLOUDINARY_CLOUD_NAME ({settings.CLOUDINARY_CLOUD_NAME!r}). "
                "In Render → Environment, set it to your cloud name — the part after res.cloudinary.com/ in your image links"
            ) from exc
        raise ValueError(f"Watermarking failed: {exc}") from exc


def _record(db: AsyncSession, url: str, storage: str, key: str, source_url: str | None) -> None:
    db.add(ImageWatermark(url=url, original_storage=storage, original_key=key, source_url=(source_url or "")[:1000] or None))


async def watermark_bytes(db: AsyncSession, data: bytes, mime_type: str | None = None, source_url: str | None = None) -> str:
    """Validate, watermark and store an image; returns the public (watermarked) URL."""
    url, storage, key = await _render_and_store(data, mime_type)
    _record(db, url, storage, key, source_url)
    await db.flush()
    return url


async def is_watermarked(db: AsyncSession, url: str) -> bool:
    return (await db.execute(select(ImageWatermark.id).where(ImageWatermark.url == url))).first() is not None


# --- fetching pasted URLs ------------------------------------------------------------------


def _assert_public_host(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Only http(s) image URLs are supported.")
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise ValueError("Could not resolve the image URL host.") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError("That image URL points to a private network address.")


async def fetch_image(url: str) -> tuple[bytes, str | None]:
    url = url.strip()
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=False, headers={"User-Agent": "KigaliRent-Watermark/1.0"}) as client:
        for _ in range(5):
            await asyncio.to_thread(_assert_public_host, url)
            async with client.stream("GET", url) as res:
                if res.is_redirect and res.headers.get("location"):
                    url = str(res.url.join(res.headers["location"]))
                    continue
                if res.status_code >= 400:
                    raise ValueError(f"Could not download the image (HTTP {res.status_code}).")
                chunks, size = [], 0
                async for chunk in res.aiter_bytes():
                    size += len(chunk)
                    if size > MAX_IMAGE_BYTES:
                        raise ValueError("Image too large (max 10 MB)")
                    chunks.append(chunk)
                mime = (res.headers.get("content-type") or "").split(";")[0].strip() or None
                if mime and not mime.startswith("image/"):
                    mime = None
                return b"".join(chunks), mime
    raise ValueError("Too many redirects while downloading the image.")


async def watermark_url(db: AsyncSession, url: str) -> tuple[str, bool]:
    """Watermark the image at `url`. Returns (public_url, already_watermarked)."""
    url = url.strip()
    if await is_watermarked(db, url):
        return url, True
    data, mime = await fetch_image(url)
    return await watermark_bytes(db, data, mime, source_url=url), False


async def watermark_urls(db: AsyncSession, urls: list[str]) -> dict[str, str]:
    """Watermark several pasted URLs in parallel. Returns {original_url: watermarked_url}.

    URLs that are already watermarked map to themselves. Raises ValueError naming the first
    URL that failed, so the caller can refuse to save an un-watermarked photo silently.
    """
    unique = list(dict.fromkeys(u.strip() for u in urls if u and u.strip()))
    if not unique:
        return {}
    known = set((await db.execute(select(ImageWatermark.url).where(ImageWatermark.url.in_(unique)))).scalars())
    result = {u: u for u in unique if u in known}
    todo = [u for u in unique if u not in known]
    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(u: str) -> tuple[str, str, str]:
        async with sem:
            data, mime = await fetch_image(u)
            return await _render_and_store(data, mime)

    outcomes = await asyncio.gather(*(one(u) for u in todo), return_exceptions=True)
    for u, out in zip(todo, outcomes):
        if isinstance(out, BaseException):
            raise ValueError(f"Could not add the watermark to {u[:120]}: {out}")
        url, storage, key = out
        _record(db, url, storage, key, u)
        result[u] = url
    await db.flush()
    return result
