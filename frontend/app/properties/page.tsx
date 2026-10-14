import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchBar } from "@/components/search/search-bar";
import { SearchBarPlaceholder } from "@/components/search/search-bar-placeholder";
import { ActivePropertyFilters } from "@/components/search/active-property-filters";
import { PropertiesInfiniteGrid } from "@/components/property/properties-infinite-grid";
import { PROPERTIES_PAGE_SIZE } from "@/lib/property-search-params";
import { PropertyCard } from "@/components/property/property-card";
import { PropertyGridSkeleton } from "@/components/ui/shimmer";
import { RecentlyViewedStrip } from "@/components/property/recently-viewed-strip";
import { WhatsAppMatchAlert } from "@/components/property/whatsapp-match-alert";
import { buildRentalCollectionPageJsonLd } from "@/lib/rental-jsonld";
import { fetchPropertiesSafe } from "@/lib/server-api";
import { pageOpenGraph } from "@/lib/seo-metadata";
import type { PaginatedResponse, PropertyListItem } from "@/types";

export const revalidate = 300;

const PAGE_URL = "https://kigalirent.com/properties";
const PAGE_TITLE = "Houses & Apartments for Rent and Sale in Kigali";
const PAGE_DESCRIPTION =
  "Browse every Kigali Rent listing: houses, apartments and furnished homes for rent, plus houses and plots for sale across Kigali, Rwanda.";

export async function generateMetadata(): Promise<Metadata> {
  const initialPage = await fetchPropertiesSafe({
    sort_by: "created_at",
    sort_order: "desc",
    page: 1,
    page_size: PROPERTIES_PAGE_SIZE,
  });
  const images = initialPage.items.map((p) => p.primary_image).filter(Boolean);
  return {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    alternates: { canonical: PAGE_URL },
    openGraph: pageOpenGraph({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      url: PAGE_URL,
      image: images[0],
      images,
      imageAlt: PAGE_TITLE,
    }),
  };
}

function InitialGrid({ data }: { data: PaginatedResponse<PropertyListItem> }) {
  if (!data.items.length) return <PropertyGridSkeleton count={6} />;
  return (
    <>
      <p className="text-gray-500 mb-8">{data.total} properties found</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {data.items.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </>
  );
}

export default async function PropertiesPage() {
  const initialPage = await fetchPropertiesSafe({
    sort_by: "created_at",
    sort_order: "desc",
    page: 1,
    page_size: PROPERTIES_PAGE_SIZE,
  });
  const collectionJsonLd = buildRentalCollectionPageJsonLd({
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    pageUrl: PAGE_URL,
    listings: initialPage.items.slice(0, 12).map((p) => ({
      title: p.title,
      slug: p.slug,
      price: p.price,
      usd_price: p.usd_price,
      currency: p.currency,
      primary_image: p.primary_image,
      primary_image_alt: p.primary_image_alt,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      neighborhood_name: p.neighborhood_name,
      district_name: p.district_name,
      property_type_name: p.property_type_name,
      is_furnished: p.is_furnished,
      listing_type: p.listing_type,
    })),
  });

  return (
    <>
      {collectionJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
        />
      )}
      <div className="bg-navy-800 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">BROWSE LISTINGS</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-3">All Properties in Kigali</h1>
        </div>
      </div>
      <Suspense fallback={<SearchBarPlaceholder />}>
        <SearchBar />
      </Suspense>
      <Suspense fallback={null}>
        <RecentlyViewedStrip />
      </Suspense>
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={null}>
            <ActivePropertyFilters />
          </Suspense>
          <Suspense fallback={null}>
            <WhatsAppMatchAlert />
          </Suspense>
          {/* useSearchParams bails out of static rendering, so the fallback is what crawlers receive. */}
          <Suspense fallback={<InitialGrid data={initialPage} />}>
            <PropertiesInfiniteGrid initialPage={initialPage.items.length ? initialPage : undefined} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
