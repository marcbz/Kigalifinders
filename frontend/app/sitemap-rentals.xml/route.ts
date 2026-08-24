import { getRentalsSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

/** Always hit the live API — never serve a permanently empty/stale build. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";

  try {
    const { entries, meta } = await getRentalsSitemapEntries(new Date(), { debug });

    // Failed upstream must not become a cached empty sitemap (crawlers treat empty as truth)
    if (meta.error) {
      console.error("[sitemap-rentals] upstream failed", meta);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`,
        {
          status: 503,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Sitemap-Error": meta.error.slice(0, 200),
            "X-Sitemap-Source": meta.apiUrl,
          },
        },
      );
    }

    console.info("[sitemap-rentals] urls=", entries.length, {
      apiUrl: meta.apiUrl,
      hubCount: meta.hubCount,
      intentCount: meta.intentCount,
    });

    const res = xmlResponse(buildUrlSetXml(entries), {
      // Short CDN TTL so SEO/sitemap status changes appear quickly
      cacheControl: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    });

    if (debug) {
      res.headers.set("X-Sitemap-Count", String(entries.length));
      res.headers.set("X-Sitemap-Source", meta.apiUrl || "unknown");
      if (meta.diagnostics) {
        res.headers.set("X-Sitemap-Diagnostics", JSON.stringify(meta.diagnostics).slice(0, 1800));
      }
    }
    return res;
  } catch (error) {
    console.error("[sitemap-rentals] fatal", error);
    // Prefer 503 over an empty valid sitemap (empty tells crawlers there are no URLs)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`,
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Sitemap-Error": "upstream_unavailable",
        },
      },
    );
  }
}
