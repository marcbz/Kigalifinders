import { getPropertiesSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    return xmlResponse(buildUrlSetXml(await getPropertiesSitemapEntries()));
  } catch (error) {
    console.error("[sitemap-properties]", error);
    return xmlResponse(buildUrlSetXml([]));
  }
}
