import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AreaGuidePage } from "@/components/areas/area-guide-page";
import { getAreaSeoContent } from "@/lib/area-content";
import { getAreaHref, getAreaIndexHref } from "@/lib/areas";
import {
  fetchNeighborhoodBySlugSafe,
  fetchSearchFilterNeighborhoodsSafe,
  fetchPropertiesSafe,
} from "@/lib/server-api";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const neighborhoods = await fetchSearchFilterNeighborhoodsSafe();
  return neighborhoods.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const neighborhood = await fetchNeighborhoodBySlugSafe(slug);
  if (!neighborhood) return { title: "Area Not Found" };

  const content = getAreaSeoContent(neighborhood);
  const canonical = `https://kigalirent.com${getAreaHref(neighborhood.slug)}`;
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical },
    openGraph: {
      title: content.metaTitle,
      description: content.metaDescription,
      type: "website",
      url: canonical,
    },
  };
}

export default async function AreaLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const neighborhood = await fetchNeighborhoodBySlugSafe(slug);
  if (!neighborhood) notFound();

  const content = getAreaSeoContent(neighborhood);
  const properties = await fetchPropertiesSafe({
    neighborhood_slug: neighborhood.slug,
    page_size: 24,
    sort_by: "created_at",
    sort_order: "desc",
  });
  const allAreas = await fetchSearchFilterNeighborhoodsSafe();
  const related = content.relatedSlugs.flatMap((relatedSlug) => {
    const area = allAreas.find((item) => item.slug === relatedSlug);
    if (!area || area.slug === neighborhood.slug) return [];
    return [{ slug: area.slug, name: area.name }];
  });

  const pageUrl = `https://kigalirent.com${getAreaHref(neighborhood.slug)}`;
  const areaIndexUrl = `https://kigalirent.com${getAreaIndexHref()}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://kigalirent.com" },
          { "@type": "ListItem", position: 2, name: "Neighborhoods", item: areaIndexUrl },
          { "@type": "ListItem", position: 3, name: neighborhood.name, item: pageUrl },
        ],
      },
      {
        "@type": "WebPage",
        name: content.metaTitle,
        description: content.metaDescription,
        url: pageUrl,
        about: {
          "@type": "Place",
          name: `${neighborhood.name}${neighborhood.district_name ? `, ${neighborhood.district_name}` : ""}`,
          address: {
            "@type": "PostalAddress",
            addressLocality: neighborhood.name,
            addressRegion: neighborhood.district_name || "Kigali",
            addressCountry: "RW",
          },
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <AreaGuidePage
        name={neighborhood.name}
        slug={neighborhood.slug}
        districtName={neighborhood.district_name}
        content={content}
        properties={properties}
        related={related}
      />
    </>
  );
}
