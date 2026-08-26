import { getResearchSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    return xmlResponse(buildUrlSetXml(getResearchSitemapEntries()));
  } catch (error) {
    console.error("[sitemap-research]", error);
    const now = new Date();
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://kigalirent.com";
    return xmlResponse(
      buildUrlSetXml([
        {
          loc: `${base}/research/kigali-rental-market`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.8,
        },
      ]),
      { cacheControl: "no-store" },
    );
  }
}
