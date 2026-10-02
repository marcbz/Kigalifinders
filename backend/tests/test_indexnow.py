import pytest

from app.services import indexnow
from app.services.indexnow import _locs, blog_urls, property_urls, research_urls

INDEX_XML = """<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://kigalirent.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://kigalirent.com/sitemap-blog.xml</loc></sitemap>
</sitemapindex>"""

URLSET_XML = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://kigalirent.com/</loc><lastmod>2026-10-02</lastmod></url>
  <url><loc> https://kigalirent.com/blog/renting-in-kigali </loc></url>
</urlset>"""


def test_sitemap_index_and_urlset_are_parsed():
    assert _locs(INDEX_XML) == (
        ["https://kigalirent.com/sitemap-pages.xml", "https://kigalirent.com/sitemap-blog.xml"],
        [],
    )
    assert _locs(URLSET_XML) == ([], ["https://kigalirent.com/", "https://kigalirent.com/blog/renting-in-kigali"])


def test_url_builders_include_index_pages_and_dedupe_slugs():
    assert blog_urls("new-post", "new-post", None) == [
        "https://kigalirent.com/blog/new-post",
        "https://kigalirent.com/blog",
    ]
    assert property_urls("a", "b")[-1] == "https://kigalirent.com/properties"
    urls = research_urls()
    assert "https://kigalirent.com/research/kigali-rental-market/compare" in urls
    assert "https://kigalirent.com/" in urls


@pytest.mark.asyncio
async def test_submissions_are_skipped_outside_production():
    assert await indexnow.submit_urls(["https://kigalirent.com/"]) is False


@pytest.mark.asyncio
async def test_research_resubmission_is_throttled(monkeypatch):
    sent: list[list[str]] = []

    async def fake_submit(urls):
        sent.append(list(urls))
        return True

    monkeypatch.setattr(indexnow, "submit_urls", fake_submit)
    monkeypatch.setattr(indexnow, "_last_research_submit", 0.0)
    assert await indexnow.submit_research_pages() is True
    assert await indexnow.submit_research_pages() is False
    assert await indexnow.submit_research_pages(force=True) is True
    assert len(sent) == 2
