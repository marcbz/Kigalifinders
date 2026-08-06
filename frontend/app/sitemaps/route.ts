import { getSitemapIndexEntries } from "@/lib/sitemap-data";
import { buildSitemapIndexXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  const now = new Date();
  return xmlResponse(buildSitemapIndexXml(getSitemapIndexEntries(now)));
}
