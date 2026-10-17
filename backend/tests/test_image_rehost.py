import pytest

from app.core.config import settings
from app.services import cloudinary_config as cld_cfg
from app.services import image_rehost as rehost


@pytest.fixture(autouse=True)
def _cloud_name(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "opgcvbbk")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "secret")
    monkeypatch.setattr(settings, "AWS_S3_BUCKET", "")
    yield


def test_cloudinary_cloud_from_url():
    assert (
        rehost.cloudinary_cloud_from_url(
            "https://res.cloudinary.com/df0vlorfg/image/upload/v1/bluestone-realty/x.jpg"
        )
        == "df0vlorfg"
    )
    assert rehost.cloudinary_cloud_from_url("https://images.unsplash.com/photo.jpg") is None


def test_is_our_hosted_url():
    ours = "https://res.cloudinary.com/opgcvbbk/image/upload/v1/kigalifinders/properties/a.jpg"
    foreign = "https://res.cloudinary.com/df0vlorfg/image/upload/v1/bluestone-realty/a.jpg"
    assert rehost.is_our_hosted_url(ours) is True
    assert rehost.is_our_hosted_url(foreign) is False
    assert rehost.needs_rehost(ours) is False
    assert rehost.needs_rehost(foreign) is True


def test_is_our_hosted_url_case_insensitive(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "OPGCVBBK")
    ours = "https://res.cloudinary.com/opgcvbbk/image/upload/v1/a.jpg"
    assert rehost.is_our_hosted_url(ours) is True
    assert rehost.needs_rehost(ours) is False


def test_rejects_root_as_cloud_name():
    assert cld_cfg.is_plausible_cloudinary_cloud_name("Root") is False
    assert cld_cfg.is_plausible_cloudinary_cloud_name("opgcvbbk") is True
    assert cld_cfg.normalize_cloudinary_cloud_name('"opgcvbbk"') == "opgcvbbk"


def test_root_cloud_name_keeps_media_library_urls(monkeypatch):
    """Mis-set CLOUDINARY_CLOUD_NAME=Root must not block saving already-hosted photos."""
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "Root")
    ours = (
        "https://res.cloudinary.com/opgcvbbk/image/upload/"
        "Furnished_5_Bedroom_House_For_Rent_In_Kigali_Kibagabaga_Near_Pilipili_F"
    )
    foreign = "https://res.cloudinary.com/df0vlorfg/image/upload/v1/a.jpg"
    remote = "https://images.example.com/house.jpg"

    assert cld_cfg.configured_cloudinary_cloud_name() == ""
    assert cld_cfg.cloudinary_ready() is False
    assert rehost.storage_configured() is False
    assert rehost.needs_rehost(ours) is False
    assert rehost.needs_rehost(foreign) is False  # cannot copy while destination is broken
    assert rehost.needs_rehost(remote) is True


def test_assert_public_host_blocks_loopback():
    with pytest.raises(ValueError, match="private"):
        rehost._assert_public_host("http://127.0.0.1/secret.jpg")


@pytest.mark.asyncio
async def test_rehost_urls_skips_ours(monkeypatch):
    ours = "https://res.cloudinary.com/opgcvbbk/image/upload/v1/a.jpg"
    called = {"n": 0}

    async def boom(_url, folder="x"):
        called["n"] += 1
        raise AssertionError("should not fetch our own URL")

    monkeypatch.setattr(rehost, "rehost_url", boom)
    out = await rehost.rehost_urls([ours, ours])
    assert out == {ours: ours}
    assert called["n"] == 0


@pytest.mark.asyncio
async def test_rehost_urls_skips_when_cloud_name_is_root(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "Root")
    url = (
        "https://res.cloudinary.com/opgcvbbk/image/upload/"
        "Furnished_5_Bedroom_House_For_Rent_In_Kigali_Kibagabaga_Near_Pilipili_F"
    )
    called = {"n": 0}

    async def boom(_url, folder="x"):
        called["n"] += 1
        raise AssertionError("should not rehost while cloud name is invalid")

    monkeypatch.setattr(rehost, "rehost_url", boom)
    out = await rehost.rehost_urls([url])
    assert out == {url: url}
    assert called["n"] == 0


@pytest.mark.asyncio
async def test_rehost_urls_maps_foreign(monkeypatch):
    foreign = "https://res.cloudinary.com/df0vlorfg/image/upload/v1/a.jpg"
    hosted = "https://res.cloudinary.com/opgcvbbk/image/upload/v2/copied.jpg"

    async def fake_rehost(url, folder="x"):
        assert url == foreign
        return hosted

    monkeypatch.setattr(rehost, "rehost_url", fake_rehost)
    out = await rehost.rehost_urls([foreign])
    assert out == {foreign: hosted}


@pytest.mark.asyncio
async def test_rehost_urls_error_mentions_foreign_cloud(monkeypatch):
    foreign = "https://res.cloudinary.com/df0vlorfg/image/upload/v1/a.jpg"

    async def fail(url, folder="x"):
        raise ValueError("Could not download the image (HTTP 401: cloud_name df0vlorfg is disabled).")

    monkeypatch.setattr(rehost, "rehost_url", fail)
    with pytest.raises(ValueError, match="df0vlorfg"):
        await rehost.rehost_urls([foreign])


@pytest.mark.asyncio
async def test_rehost_urls_invalid_cloud_name_error_is_actionable(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "Root")
    remote = "https://images.example.com/house.jpg"

    async def fail(url, folder="x"):
        raise ValueError("Cloudinary upload failed: Invalid cloud_name Root")

    monkeypatch.setattr(rehost, "rehost_url", fail)
    with pytest.raises(ValueError, match="CLOUDINARY_CLOUD_NAME"):
        await rehost.rehost_urls([remote])
