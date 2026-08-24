import { getRentalsSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    return xmlResponse(buildUrlSetXml(await getRentalsSitemapEntries()));
  } catch (error) {
    console.error("[sitemap-rentals]", error);
    return xmlResponse(buildUrlSetXml([]));
  }
}
