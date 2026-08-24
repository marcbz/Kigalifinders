import { getResearchSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    return xmlResponse(buildUrlSetXml(getResearchSitemapEntries()));
  } catch (error) {
    console.error("[sitemap-research]", error);
    return xmlResponse(buildUrlSetXml([]));
  }
}
