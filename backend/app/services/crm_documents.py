"""Private CRM document storage.

Files are uploaded to Cloudinary as `type=authenticated` raw assets, which are not
publicly deliverable. Admins download them through short-lived signed URLs issued
by an authenticated endpoint.
"""

from __future__ import annotations

import os
import time
import uuid

from app.core.config import settings

MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
DOWNLOAD_URL_TTL_SECONDS = 300
FOLDER = "kigalirent-crm"
ALLOWED_EXTENSIONS = {
    ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic",
    ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt",
}


def storage_configured() -> bool:
    return bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)


def _configure():
    import cloudinary

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def _extension(filename: str) -> str:
    return os.path.splitext(filename or "")[1].lower()


def validate_document(data: bytes, filename: str) -> str:
    if not data:
        raise ValueError("The file is empty.")
    if len(data) > MAX_DOCUMENT_BYTES:
        raise ValueError("File too large (max 10 MB).")
    ext = _extension(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}.")
    return ext


def upload_private_document(data: bytes, filename: str) -> dict:
    if not storage_configured():
        raise ValueError("Document storage is not configured (Cloudinary credentials missing).")
    ext = validate_document(data, filename)
    _configure()
    import cloudinary.uploader

    public_id = f"{FOLDER}/{uuid.uuid4().hex}{ext}"
    try:
        result = cloudinary.uploader.upload(
            data,
            public_id=public_id,
            resource_type="raw",
            type="authenticated",
            overwrite=False,
        )
    except Exception as exc:
        raise ValueError(f"Upload failed: {exc}") from exc
    return {
        "storage_key": result.get("public_id", public_id),
        "resource_type": result.get("resource_type", "raw"),
        "file_format": ext.lstrip("."),
        "size_bytes": result.get("bytes", len(data)),
    }


def signed_download_url(storage_key: str, resource_type: str | None = "raw") -> str:
    _configure()
    import cloudinary.utils

    return cloudinary.utils.private_download_url(
        storage_key,
        "",
        resource_type=resource_type or "raw",
        type="authenticated",
        expires_at=int(time.time()) + DOWNLOAD_URL_TTL_SECONDS,
    )


def delete_private_document(storage_key: str, resource_type: str | None = "raw") -> None:
    if not storage_configured():
        return
    _configure()
    import cloudinary.uploader

    try:
        cloudinary.uploader.destroy(storage_key, resource_type=resource_type or "raw", type="authenticated")
    except Exception:
        pass
