import { getPropertiesSitemapEntries, SITEMAP_REVALIDATE_SECONDS } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = SITEMAP_REVALIDATE_SECONDS;

export async function GET() {
  return xmlResponse(buildUrlSetXml(await getPropertiesSitemapEntries()));
}
