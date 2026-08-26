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
    const now = new Date();
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://kigalirent.com";
    // Always return at least the blog index URL — never an empty <urlset>.
    return xmlResponse(
      buildUrlSetXml([{ loc: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 }]),
      { cacheControl: "no-store", headers: { "X-Sitemap-Error": "blog_fallback" } },
    );
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
