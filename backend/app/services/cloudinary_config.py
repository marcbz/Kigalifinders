"""Normalize and validate CLOUDINARY_CLOUD_NAME from the environment.

Operators sometimes paste Render’s “Root Directory” value (`Root` / `frontend`)
into CLOUDINARY_CLOUD_NAME by mistake. That makes every upload fail with
`Invalid cloud_name` and also makes already-hosted Media Library URLs look
“foreign”, so listing saves try to re-copy them and error out.
"""

from __future__ import annotations

import logging
import re

from app.core.config import settings

logger = logging.getLogger(__name__)

# Values that are never a real Cloudinary cloud name (common deploy-form mixups).
_BAD_CLOUD_NAMES = frozenset(
    {
        "root",
        "root directory",
        "rootdir",
        "frontend",
        "backend",
        "www",
        "api",
        "app",
        "public",
        "private",
        "cloudinary",
    }
)

_CLOUD_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")

# When CLOUDINARY_CLOUD_NAME is the Render mix-up "Root", recover to the cloud
# already used by this project’s Media Library URLs so listing saves / uploads work
# without waiting on a manual env edit. Override with CLOUDINARY_CLOUD_NAME_FALLBACK.
_DEFAULT_ROOT_MIXUP_FALLBACK = "opgcvbbk"
_logged_root_mixup = False


def normalize_cloudinary_cloud_name(raw: str | None) -> str:
    """Strip whitespace and accidental quoting from an env value."""
    return (raw or "").strip().strip('"').strip("'").strip()


def is_plausible_cloudinary_cloud_name(name: str | None) -> bool:
    name = normalize_cloudinary_cloud_name(name)
    if not name:
        return False
    if name.lower() in _BAD_CLOUD_NAMES:
        return False
    if any(ch in name for ch in (" ", "/", "\\", ".")):
        return False
    return bool(_CLOUD_NAME_RE.fullmatch(name))


def _root_mixup_fallback() -> str:
    fallback = normalize_cloudinary_cloud_name(
        getattr(settings, "CLOUDINARY_CLOUD_NAME_FALLBACK", None)
        or _DEFAULT_ROOT_MIXUP_FALLBACK
    )
    return fallback if is_plausible_cloudinary_cloud_name(fallback) else ""


def configured_cloudinary_cloud_name() -> str:
    """Cloud name to use for API calls / ownership checks, or '' if unusable."""
    name = normalize_cloudinary_cloud_name(settings.CLOUDINARY_CLOUD_NAME)
    if is_plausible_cloudinary_cloud_name(name):
        return name
    # Recover the common Render “Root Directory” paste into CLOUDINARY_CLOUD_NAME.
    if name.lower() == "root":
        fallback = _root_mixup_fallback()
        if fallback:
            global _logged_root_mixup
            if not _logged_root_mixup:
                _logged_root_mixup = True
                logger.warning(
                    "CLOUDINARY_CLOUD_NAME=%r is invalid (Render Root Directory mix-up); "
                    "using %r so uploads and listing saves keep working. Set "
                    "CLOUDINARY_CLOUD_NAME=%s on the API host.",
                    name,
                    fallback,
                    fallback,
                )
            return fallback
    return ""


def cloudinary_credentials_present() -> bool:
    return bool(
        normalize_cloudinary_cloud_name(settings.CLOUDINARY_CLOUD_NAME)
        and (settings.CLOUDINARY_API_KEY or "").strip()
        and (settings.CLOUDINARY_API_SECRET or "").strip()
    )


def cloudinary_ready() -> bool:
    """True when Cloudinary can actually accept uploads (plausible cloud + keys)."""
    return bool(
        configured_cloudinary_cloud_name()
        and (settings.CLOUDINARY_API_KEY or "").strip()
        and (settings.CLOUDINARY_API_SECRET or "").strip()
    )


def invalid_cloud_name_message(suggested_from_url: str | None = None) -> str:
    raw = normalize_cloudinary_cloud_name(settings.CLOUDINARY_CLOUD_NAME)
    suggestion = ""
    if suggested_from_url and is_plausible_cloudinary_cloud_name(suggested_from_url):
        suggestion = (
            f" Your image URL uses cloud “{suggested_from_url}” — set"
            f" CLOUDINARY_CLOUD_NAME={suggested_from_url} on the API host (Render)."
        )
    elif raw:
        suggestion = (
            f" Current value {raw!r} is not a valid Cloudinary cloud name"
            " (do not use Render’s “Root Directory”)."
        )
    return (
        "Cloudinary is misconfigured: set CLOUDINARY_CLOUD_NAME to the cloud name"
        " shown in your Cloudinary dashboard (the segment after"
        " res.cloudinary.com/ in your image URLs)."
        f"{suggestion}"
    )
