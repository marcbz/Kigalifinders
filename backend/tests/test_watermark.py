import asyncio
import io
import sys
import types

import pytest
from PIL import Image

for _mod in ("cloudinary", "cloudinary.uploader"):
    sys.modules.setdefault(_mod, types.ModuleType(_mod))

from app.services import watermark as wm  # noqa: E402


def _jpeg(size=(1200, 800), color=(240, 240, 235)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "JPEG")
    return buf.getvalue()


def test_watermark_is_centered_and_keeps_size():
    out = Image.open(io.BytesIO(wm.apply_watermark(_jpeg())))
    assert out.format == "JPEG" and out.size == (1200, 800)
    w, h = out.size
    center_band = [out.getpixel((x, h // 2)) for x in range(int(w * 0.2), int(w * 0.8), 4)]
    corner = out.getpixel((10, 10))
    assert any(abs(sum(p) - sum(corner)) > 60 for p in center_band)
    assert out.getpixel((10, h - 10)) == pytest.approx(corner, abs=6)


def test_large_and_png_images_are_normalised():
    buf = io.BytesIO()
    Image.new("RGBA", (5000, 3000), (10, 20, 30, 128)).save(buf, "PNG")
    out = Image.open(io.BytesIO(wm.apply_watermark(buf.getvalue())))
    assert max(out.size) == wm.MAX_EDGE and out.mode == "RGB"


def test_bundled_assets_are_used():
    assert wm.LOGO_PATH.exists() and wm.FONT_PATH.exists()
    assert getattr(wm._font(30), "path", "").endswith("DejaVuSans-Bold.ttf")


@pytest.mark.parametrize("url", ["http://127.0.0.1/x.jpg", "http://localhost/x.jpg", "ftp://example.com/x.jpg", "http://10.0.0.5/a.png"])
def test_private_or_non_http_urls_are_rejected(url):
    with pytest.raises(ValueError):
        wm._assert_public_host(url)


class _DB:
    def __init__(self, known=()):
        self.known = set(known)
        self.added = []

    async def execute(self, stmt):
        url = stmt.compile().params.get("url_1")
        return type("R", (), {"first": lambda self: (1,) if url in known else None})()

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass


known: set = set()


def test_watermark_url_is_idempotent_and_records_original(monkeypatch):
    known.clear()
    known.add("https://res.cloudinary.com/x/marked.jpg")
    db = _DB()
    url, already = asyncio.run(wm.watermark_url(db, "https://res.cloudinary.com/x/marked.jpg"))
    assert already and url.endswith("marked.jpg") and not db.added

    async def fake_fetch(u):
        return _jpeg(), "image/jpeg"

    monkeypatch.setattr(wm, "fetch_image", fake_fetch)
    monkeypatch.setattr(wm, "storage_configured", lambda: True)
    monkeypatch.setattr(wm, "_store_original", lambda data: ("cloudinary", "kigalifinders/originals/abc"))
    monkeypatch.setattr(wm, "_store_public", lambda data: "https://res.cloudinary.com/x/new.jpg")
    url, already = asyncio.run(wm.watermark_url(db, "https://example.com/photo.jpg"))
    assert not already and url == "https://res.cloudinary.com/x/new.jpg"
    rec = db.added[0]
    assert rec.url == url and rec.original_key == "kigalifinders/originals/abc" and rec.source_url == "https://example.com/photo.jpg"
