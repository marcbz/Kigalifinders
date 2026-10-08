import { getCompareSitemapEntries, getResearchSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    const [research, compare] = await Promise.all([getResearchSitemapEntries(), getCompareSitemapEntries()]);
    return xmlResponse(buildUrlSetXml([...research, ...compare]));
  } catch (error) {
    console.error("[sitemap-research]", error);
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://kigalirent.com";
    return xmlResponse(
      buildUrlSetXml([
        {
          loc: `${base}/research/kigali-rental-market`,
          changeFrequency: "weekly",
          priority: 0.8,
        },
      ]),
      { cacheControl: "no-store" },
    );
  }
}
