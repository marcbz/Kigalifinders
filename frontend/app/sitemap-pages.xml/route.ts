import { getPagesSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    return xmlResponse(buildUrlSetXml(await getPagesSitemapEntries()));
  } catch (error) {
    console.error("[sitemap-pages]", error);
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://kigalirent.com";
    return xmlResponse(
      buildUrlSetXml([{ loc: base, changeFrequency: "daily", priority: 1 }]),
      { cacheControl: "no-store" },
    );
  }
}
