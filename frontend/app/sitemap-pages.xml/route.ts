import { getPagesSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    return xmlResponse(buildUrlSetXml(getPagesSitemapEntries()));
  } catch (error) {
    console.error("[sitemap-pages]", error);
    const now = new Date();
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://kigalirent.com";
    return xmlResponse(
      buildUrlSetXml([{ loc: base, lastModified: now, changeFrequency: "daily", priority: 1 }]),
      { cacheControl: "no-store" },
    );
  }
}
