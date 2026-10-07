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
from PIL import Image, ImageDraw, ImageFont, ImageOps
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import ImageWatermark
from app.services.media_upload import MAX_IMAGE_BYTES, _validate_image

ASSETS = Path(__file__).resolve().parent.parent / "assets"
LOGO_PATH = ASSETS / "watermark-logo.png"
FONT_PATH = ASSETS / "DejaVuSans-Bold.ttf"
WATERMARK_TEXT = "kigalirent.com"
PUBLIC_FOLDER = "kigalifinders/properties"
ORIGINALS_FOLDER = "kigalifinders/originals"
MAX_EDGE = 2560
TEXT_OPACITY = 0.62
LOGO_OPACITY = 0.70


@lru_cache(maxsize=1)
def _logo() -> Image.Image | None:
    try:
        return Image.open(LOGO_PATH).convert("RGBA")
    except Exception:
        return None


def _font(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    for name in (str(FONT_PATH), "DejaVuSans-Bold.ttf", "arialbd.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def _with_opacity(img: Image.Image, opacity: float) -> Image.Image:
    alpha = img.getchannel("A").point(lambda a: int(a * opacity))
    out = img.copy()
    out.putalpha(alpha)
    return out


def apply_watermark(data: bytes) -> bytes:
    """Return JPEG bytes with a centered, semi-transparent "Kr" logo + kigalirent.com mark."""
    with Image.open(io.BytesIO(data)) as src:
        img = ImageOps.exif_transpose(src)
        img = img.convert("RGBA")
    if max(img.size) > MAX_EDGE:
        img.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
    w, h = img.size

    font_size = max(14, int(w * 0.068))
    font = _font(font_size)
    stroke = max(1, font_size // 14)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    left, top, right, bottom = probe.textbbox((0, 0), WATERMARK_TEXT, font=font, stroke_width=stroke)
    text_w, text_h = right - left, bottom - top

    logo = _logo()
    logo_size = int(text_h * 1.9) if logo is not None else 0
    gap = int(font_size * 0.35) if logo is not None else 0
    total_w = logo_size + gap + text_w
    if total_w > w * 0.9:
        scale = (w * 0.9) / total_w
        font_size = max(12, int(font_size * scale))
        font = _font(font_size)
        stroke = max(1, font_size // 14)
        left, top, right, bottom = probe.textbbox((0, 0), WATERMARK_TEXT, font=font, stroke_width=stroke)
        text_w, text_h = right - left, bottom - top
        logo_size = int(text_h * 1.9) if logo is not None else 0
        gap = int(font_size * 0.35) if logo is not None else 0
        total_w = logo_size + gap + text_w

    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    x0 = (w - total_w) // 2
    cy = h // 2
    if logo is not None and logo_size > 0:
        mark = _with_opacity(logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS), LOGO_OPACITY)
        layer.alpha_composite(mark, (x0, cy - logo_size // 2))
    draw = ImageDraw.Draw(layer)
    text_x = x0 + logo_size + gap - left
    text_y = cy - text_h // 2 - top
    draw.text(
        (text_x, text_y),
        WATERMARK_TEXT,
        font=font,
        fill=(255, 255, 255, int(255 * TEXT_OPACITY)),
        stroke_width=stroke,
        stroke_fill=(10, 31, 68, int(255 * TEXT_OPACITY * 0.8)),
    )

    out = Image.alpha_composite(img, layer).convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=88, optimize=True, progressive=True)
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


async def watermark_bytes(db: AsyncSession, data: bytes, mime_type: str | None = None, source_url: str | None = None) -> str:
    """Validate, watermark and store an image; returns the public (watermarked) URL."""
    if not storage_configured():
        raise ValueError("Image upload is not configured. Set Cloudinary or AWS S3 credentials on the server.")
    _validate_image(data, mime_type)
    try:
        url, storage, key = await asyncio.to_thread(_process, data)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Watermarking failed: {exc}") from exc
    db.add(ImageWatermark(url=url, original_storage=storage, original_key=key, source_url=(source_url or "")[:1000] or None))
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
