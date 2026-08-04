import io
import uuid

import cloudinary
import cloudinary.uploader
from PIL import Image

from app.core.config import settings

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _validate_image(data: bytes, mime_type: str | None) -> bytes:
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("Image too large (max 10 MB)")
    if mime_type and mime_type not in ALLOWED_MIME:
        raise ValueError("Only JPEG, PNG, WebP, and GIF images are allowed")
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.verify()
    except Exception:
        raise ValueError("Invalid image file")
    return data


def _upload_cloudinary(data: bytes, folder: str) -> str:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )
    result = cloudinary.uploader.upload(
        data,
        folder=folder,
        resource_type="image",
    )
    return result["secure_url"]


def _upload_s3(data: bytes, filename: str, folder: str, mime_type: str | None) -> str:
    import boto3

    safe_name = filename.replace("/", "_").replace("\\", "_") or "image.jpg"
    key = f"{folder}/{uuid.uuid4()}-{safe_name}"
    client = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )
    client.put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=mime_type or "image/jpeg",
    )
    return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


def upload_image(data: bytes, filename: str, folder: str = "kigalifinders", mime_type: str | None = None) -> str:
    data = _validate_image(data, mime_type)

    if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
        return _upload_cloudinary(data, folder)

    if settings.AWS_S3_BUCKET and settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        return _upload_s3(data, filename, folder, mime_type)

    raise ValueError(
        "Image upload is not configured. Set Cloudinary or AWS S3 credentials on the server."
    )
