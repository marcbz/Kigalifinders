import { getSitemapIndexEntries } from "@/lib/sitemap-data";
import { buildSitemapIndexXml, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  return xmlResponse(buildSitemapIndexXml(getSitemapIndexEntries(new Date())));
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
