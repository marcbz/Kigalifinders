import { getBlogSitemapEntries } from "@/lib/sitemap-data";
import { buildUrlSetXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  try {
    return xmlResponse(buildUrlSetXml(await getBlogSitemapEntries()));
  } catch (error) {
    console.error("[sitemap-blog]", error);
    return xmlResponse(buildUrlSetXml([]));
  }
}
