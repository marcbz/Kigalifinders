import { getPagesSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    return xmlResponse(buildUrlSetXml(getPagesSitemapEntries()));
  } catch (error) {
    console.error("[sitemap-pages]", error);
    return xmlResponse(buildUrlSetXml([]));
  }
}
