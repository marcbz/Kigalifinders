import { getBlogSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

/** Prefer fresh blog slugs; avoid serving a stale empty urlset. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const entries = await getBlogSitemapEntries();
    return xmlResponse(buildUrlSetXml(entries), {
      cacheControl: "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    });
  } catch (error) {
    console.error("[sitemap-blog]", error);
    // Individual articles only — /blog index is in sitemap-pages.xml
    return xmlResponse(buildUrlSetXml([]), {
      cacheControl: "no-store",
      headers: { "X-Sitemap-Error": "blog_fallback" },
    });
  }
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
