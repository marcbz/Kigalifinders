import {
  getSitemapIndexEntries,
  SITEMAP_REVALIDATE_SECONDS,
} from "@/lib/sitemap-data";
import { buildSitemapIndexXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = SITEMAP_REVALIDATE_SECONDS;

export async function GET() {
  const now = new Date();
  return xmlResponse(buildSitemapIndexXml(getSitemapIndexEntries(now)));
}
