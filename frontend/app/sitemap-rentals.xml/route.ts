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

    // Always HTTP 200. Entries are rental-specific only (/rentals/{hood|intent}),
    // never /rentals or /rentals/kigali (those live in sitemap-pages.xml).
    const res = xmlResponse(buildUrlSetXml(entries), {
      cacheControl: meta.error
        ? "public, max-age=0, s-maxage=30, stale-while-revalidate=120"
        : "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      headers: meta.error
        ? {
            "X-Sitemap-Upstream-Error": meta.error.slice(0, 200),
            "X-Sitemap-Source": meta.apiUrl || "unknown",
          }
        : undefined,
    });

    console.info("[sitemap-rentals] urls=", entries.length, {
      apiUrl: meta.apiUrl,
      hubCount: meta.hubCount,
      intentCount: meta.intentCount,
      upstreamError: meta.error || null,
    });

    if (debug) {
      res.headers.set("X-Sitemap-Count", String(entries.length));
      res.headers.set("X-Sitemap-Source", meta.apiUrl || "unknown");
      if (meta.error) res.headers.set("X-Sitemap-Upstream-Error", meta.error.slice(0, 200));
      if (meta.diagnostics) {
        res.headers.set("X-Sitemap-Diagnostics", JSON.stringify(meta.diagnostics).slice(0, 1800));
      }
    }
    return res;
  } catch (error) {
    console.error("[sitemap-rentals] fatal", error);
    // Empty-but-valid urlset — do not invent /rentals hubs owned by pages sitemap
    return xmlResponse(buildUrlSetXml([]), {
      cacheControl: "no-store",
      headers: { "X-Sitemap-Error": "fatal_fallback" },
    });
  }
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
