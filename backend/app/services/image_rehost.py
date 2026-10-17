"""Copy listing photos onto our own Cloudinary (or S3) so delivery does not depend on third parties.

Pasteds links from other Cloudinary clouds / local realtor sites often work on a cached
browser in Rwanda, then break for visitors elsewhere when the source account is disabled,
geo-restricted, or blocks hotlinking. Re-hosting makes every public photo use our CDN.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import socket
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.services.cloudinary_config import (
    cloudinary_credentials_present,
    cloudinary_ready,
    configured_cloudinary_cloud_name,
    invalid_cloud_name_message,
)
from app.services.media_upload import MAX_IMAGE_BYTES, upload_image

logger = logging.getLogger(__name__)

PUBLIC_FOLDER = "kigalifinders/properties"
CONCURRENCY = 4
USER_AGENT = "KigaliRent-ImageRehost/1.0"


def storage_configured() -> bool:
    s3_ready = bool(
        settings.AWS_S3_BUCKET
        and settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
    )
    return cloudinary_ready() or s3_ready


def cloudinary_cloud_from_url(url: str) -> str | None:
    try:
        parsed = urlparse(url.strip())
    except Exception:
        return None
    host = (parsed.hostname or "").lower()
    if host != "res.cloudinary.com" and not host.endswith(".cloudinary.com"):
        return None
    parts = [p for p in parsed.path.split("/") if p]
    return parts[0] if parts else None


def is_our_hosted_url(url: str) -> bool:
    """True when the URL already lives on our configured Cloudinary cloud or S3 bucket."""
    url = (url or "").strip()
    if not url:
        return False
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    host = (parsed.hostname or "").lower()

    our_cloud = configured_cloudinary_cloud_name()
    if our_cloud:
        cloud = cloudinary_cloud_from_url(url)
        if cloud and cloud.lower() == our_cloud.lower():
            return True

    bucket = (settings.AWS_S3_BUCKET or "").strip()
    region = (settings.AWS_REGION or "").strip()
    if bucket and host in {
        f"{bucket}.s3.amazonaws.com",
        f"{bucket}.s3.{region}.amazonaws.com" if region else "",
    }:
        return True
    return False


def needs_rehost(url: str) -> bool:
    url = (url or "").strip()
    if not url:
        return False
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    # Already on our CDN — keep as-is.
    if is_our_hosted_url(url):
        return False
    # Cloudinary credentials present but cloud name is invalid (e.g. "Root"):
    # we cannot copy onto a working CDN. Keep existing Cloudinary delivery URLs
    # so admins can still save listings that use their Media Library links.
    # Non-Cloudinary remote URLs still need a working upload destination.
    if cloudinary_credentials_present() and not cloudinary_ready():
        if cloudinary_cloud_from_url(url):
            return False
    return True


def _assert_public_host(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Only http(s) image URLs are supported.")
    try:
        infos = socket.getaddrinfo(
            parsed.hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
        )
    except socket.gaierror as exc:
        raise ValueError("Could not resolve the image URL host.") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError("That image URL points to a private network address.")


async def fetch_image(url: str) -> tuple[bytes, str | None]:
    url = url.strip()
    async with httpx.AsyncClient(
        timeout=25.0,
        follow_redirects=False,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        for _ in range(5):
            await asyncio.to_thread(_assert_public_host, url)
            async with client.stream("GET", url) as res:
                if res.is_redirect and res.headers.get("location"):
                    url = str(res.url.join(res.headers["location"]))
                    continue
                if res.status_code >= 400:
                    cld_err = res.headers.get("x-cld-error")
                    if cld_err:
                        raise ValueError(f"Could not download the image (HTTP {res.status_code}: {cld_err}).")
                    raise ValueError(f"Could not download the image (HTTP {res.status_code}).")
                chunks: list[bytes] = []
                size = 0
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


async def rehost_url(url: str, folder: str = PUBLIC_FOLDER) -> str:
    """Download `url` and upload it to our storage. Returns the new public URL."""
    if is_our_hosted_url(url):
        return url.strip()
    if cloudinary_credentials_present() and not cloudinary_ready() and cloudinary_cloud_from_url(url):
        # Misconfigured cloud name — keep Media Library URLs so listing edits are not blocked.
        return url.strip()
    if not storage_configured():
        if cloudinary_credentials_present() and not cloudinary_ready():
            raise ValueError(invalid_cloud_name_message(cloudinary_cloud_from_url(url)))
        raise ValueError(
            "Image upload is not configured. Set Cloudinary or AWS S3 credentials on the server."
        )
    data, mime = await fetch_image(url)
    filename = urlparse(url).path.rsplit("/", 1)[-1] or "image.jpg"
    return await asyncio.to_thread(upload_image, data, filename, folder, mime)


async def rehost_urls(urls: list[str], folder: str = PUBLIC_FOLDER) -> dict[str, str]:
    """Rehost several URLs in parallel. Returns {original: hosted}.

    URLs already on our storage map to themselves. Raises ValueError on the first failure
    so property saves never silently keep a third-party link that will break for visitors.
    """
    unique = list(dict.fromkeys(u.strip() for u in urls if u and u.strip()))
    if not unique:
        return {}

    result = {u: u for u in unique if not needs_rehost(u)}
    todo = [u for u in unique if needs_rehost(u)]
    if not todo:
        return result

    if cloudinary_credentials_present() and not cloudinary_ready() and not storage_configured():
        # Need to copy non-Cloudinary URLs but destination cloud name is broken.
        sample = cloudinary_cloud_from_url(next((u for u in unique if cloudinary_cloud_from_url(u)), ""))
        raise ValueError(invalid_cloud_name_message(sample))

    if not storage_configured():
        raise ValueError(
            "Image upload is not configured. Set Cloudinary or AWS S3 credentials on the server."
        )

    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(u: str) -> tuple[str, str]:
        async with sem:
            return u, await rehost_url(u, folder=folder)

    outcomes = await asyncio.gather(*(one(u) for u in todo), return_exceptions=True)
    our_cloud = configured_cloudinary_cloud_name()
    for u, out in zip(todo, outcomes):
        if isinstance(out, BaseException):
            cloud = cloudinary_cloud_from_url(u)
            err_text = str(out)
            # Never block a listing save for a photo that is already on Cloudinary
            # when our upload destination cloud name is broken (e.g. "Root").
            if cloud and (
                "Invalid cloud_name" in err_text
                or (cloudinary_credentials_present() and not cloudinary_ready())
            ):
                logger.warning(
                    "Keeping existing Cloudinary URL after rehost failure (%s): %s",
                    err_text,
                    u[:120],
                )
                result[u] = u
                continue
            if "Invalid cloud_name" in err_text or (
                cloudinary_credentials_present() and not cloudinary_ready()
            ):
                raise ValueError(invalid_cloud_name_message(cloud)) from out
            hint = ""
            if cloud and our_cloud and cloud.lower() != our_cloud.lower():
                hint = (
                    f" That photo is on Cloudinary cloud “{cloud}”, not your account"
                    f" “{our_cloud}”. Download the file and Upload it,"
                    " or fix the source link."
                )
            raise ValueError(f"Could not copy {u[:120]} onto your image CDN: {out}.{hint}") from out
        _orig, hosted = out
        result[u] = hosted
    return result


async def rehost_urls_best_effort(urls: list[str], folder: str = PUBLIC_FOLDER) -> dict[str, object]:
    """Bulk migrate helper: never raises; returns per-URL success/error details."""
    unique = list(dict.fromkeys(u.strip() for u in urls if u and u.strip()))
    hosted: dict[str, str] = {}
    skipped: list[str] = []
    failed: list[dict[str, str]] = []

    for u in unique:
        if not needs_rehost(u):
            skipped.append(u)
            hosted[u] = u
            continue
        try:
            hosted[u] = await rehost_url(u, folder=folder)
        except Exception as exc:
            logger.info("Rehost failed for %s: %s", u[:120], exc)
            failed.append({"url": u, "error": str(exc)})

    return {
        "hosted": hosted,
        "skipped_already_ours": skipped,
        "failed": failed,
        "rehosted_count": len(hosted) - len(skipped),
        "failed_count": len(failed),
    }
