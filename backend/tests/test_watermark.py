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


def test_logo_is_bundled_semi_transparent_and_scaled():
    assert wm.LOGO_PATH.exists() and wm.LOGO_PATH.stat().st_size < 150_000
    logo = wm._logo()
    assert logo.mode == "RGBA" and logo.getchannel("A").getextrema()[1] <= int(255 * wm.LOGO_OPACITY) + 1
    out = Image.open(io.BytesIO(wm.apply_watermark(_jpeg((1000, 1000)))))
    row = [out.getpixel((x, 500)) for x in range(1000)]
    changed = [x for x, p in enumerate(row) if abs(sum(p) - sum(row[0])) > 40]
    span = changed[-1] - changed[0]
    assert 0.4 * 1000 < span < 0.6 * 1000 and abs((changed[0] + changed[-1]) / 2 - 500) < 30


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


class _BatchDB:
    def __init__(self, known=()):
        self.known = list(known)
        self.added = []

    async def execute(self, stmt):
        rows = self.known
        return type("R", (), {"scalars": lambda self: iter(rows)})()

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass


def _fake_storage(monkeypatch, fail=()):
    async def fake_fetch(u):
        if u in fail:
            raise ValueError("HTTP 404")
        return _jpeg(), "image/jpeg"

    monkeypatch.setattr(wm, "fetch_image", fake_fetch)
    monkeypatch.setattr(wm, "storage_configured", lambda: True)
    monkeypatch.setattr(wm, "_store_original", lambda data: ("cloudinary", "orig"))
    counter = iter(range(100))
    monkeypatch.setattr(wm, "_store_public", lambda data: f"https://res.cloudinary.com/x/wm{next(counter)}.jpg")


def test_watermark_urls_skips_known_and_dedupes(monkeypatch):
    _fake_storage(monkeypatch)
    db = _BatchDB(known=["https://cdn/a-marked.jpg"])
    out = asyncio.run(wm.watermark_urls(db, ["https://cdn/a-marked.jpg", "https://cdn/b.jpg", " https://cdn/b.jpg ", ""]))
    assert out["https://cdn/a-marked.jpg"] == "https://cdn/a-marked.jpg"
    assert out["https://cdn/b.jpg"].startswith("https://res.cloudinary.com/x/wm")
    assert len(db.added) == 1 and db.added[0].source_url == "https://cdn/b.jpg"


def test_watermark_urls_reports_the_failing_photo(monkeypatch):
    _fake_storage(monkeypatch, fail={"https://cdn/broken.jpg"})
    with pytest.raises(ValueError, match="broken.jpg"):
        asyncio.run(wm.watermark_urls(_BatchDB(), ["https://cdn/ok.jpg", "https://cdn/broken.jpg"]))


def test_saving_a_listing_watermarks_only_new_photos(monkeypatch):
    from types import SimpleNamespace

    from app.api.v1.endpoints import properties as ep
    from app.schemas import PropertyImageInput

    seen = {}

    async def fake_watermark_urls(db, urls):
        seen["urls"] = list(urls)
        return {u: u.replace(".jpg", "-wm.jpg") for u in urls}

    monkeypatch.setattr(wm, "watermark_urls", fake_watermark_urls)

    existing = [SimpleNamespace(url="https://cdn/old.jpg")]

    class DB:
        added, deleted = [], []

        async def execute(self, stmt):
            return type("R", (), {"scalars": lambda self: type("S", (), {"all": lambda self: existing})()})()

        async def delete(self, obj):
            self.deleted.append(obj)

        async def flush(self):
            pass

        def add(self, obj):
            self.added.append(obj)

    db = DB()
    images = [PropertyImageInput(url="https://cdn/old.jpg", is_primary=True), PropertyImageInput(url="https://cdn/new.jpg")]
    asyncio.run(ep._sync_property_images(db, SimpleNamespace(id="p1"), images, watermark=True))
    assert seen["urls"] == ["https://cdn/new.jpg"]
    assert [i.url for i in db.added] == ["https://cdn/old.jpg", "https://cdn/new-wm.jpg"]
