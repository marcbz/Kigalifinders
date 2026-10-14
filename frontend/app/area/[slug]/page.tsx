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
  const listings = await fetchPropertiesSafe({
    neighborhood_slug: neighborhood.slug,
    page_size: 24,
    sort_by: "created_at",
    sort_order: "desc",
  });
  const cover = listings.items.find((p) => p.primary_image)?.primary_image;
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical },
    openGraph: {
      title: content.metaTitle,
      description: content.metaDescription,
      type: "website",
      url: canonical,
      siteName: "Kigali Rent",
      locale: "en_RW",
      ...(cover ? { images: [{ url: cover, alt: `Homes for rent in ${neighborhood.name}, Kigali` }] } : {}),
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
  const listingImages = properties.items
    .map((p) => p.primary_image)
    .filter((url): url is string => Boolean(url))
    .slice(0, 12);
  const itemList =
    properties.items.length > 0
      ? {
          "@type": "ItemList",
          name: `Homes in ${neighborhood.name}`,
          url: pageUrl,
          numberOfItems: properties.items.length,
          itemListElement: properties.items.slice(0, 12).map((property, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": ["RealEstateListing", "Product"],
              name: property.title,
              url: `https://kigalirent.com/properties/${encodeURIComponent(property.slug)}`,
              ...(property.primary_image
                ? {
                    image: {
                      "@type": "ImageObject",
                      url: property.primary_image,
                      caption: property.primary_image_alt || property.title,
                    },
                  }
                : {}),
              ...(property.usd_price != null || property.price != null
                ? {
                    offers: {
                      "@type": "Offer",
                      price: property.usd_price ?? property.price,
                      priceCurrency: property.currency || "USD",
                    },
                  }
                : {}),
              ...(property.bedrooms != null ? { numberOfRooms: property.bedrooms } : {}),
            },
          })),
        }
      : null;
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
        "@type": "CollectionPage",
        name: content.metaTitle,
        description: content.metaDescription,
        url: pageUrl,
        ...(listingImages.length
          ? {
              image: listingImages,
              primaryImageOfPage: { "@type": "ImageObject", url: listingImages[0] },
            }
          : {}),
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
        ...(itemList ? { mainEntity: itemList } : {}),
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
