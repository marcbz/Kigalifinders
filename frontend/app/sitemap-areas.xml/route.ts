import { getAreasSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    return xmlResponse(buildUrlSetXml(await getAreasSitemapEntries()));
  } catch (error) {
    console.error("[sitemap-areas]", error);
    return xmlResponse(buildUrlSetXml([]));
  }
}
