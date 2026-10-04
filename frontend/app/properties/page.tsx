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
import { fetchPropertiesSafe } from "@/lib/server-api";
import { pageOpenGraph } from "@/lib/seo-metadata";
import type { PaginatedResponse, PropertyListItem } from "@/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Houses & Apartments for Rent and Sale in Kigali",
  description:
    "Browse every Kigali Rent listing: houses, apartments and furnished homes for rent, plus houses and plots for sale across Kigali, Rwanda.",
  alternates: { canonical: "https://kigalirent.com/properties" },
  openGraph: pageOpenGraph({
    title: "Houses & Apartments for Rent and Sale in Kigali",
    url: "https://kigalirent.com/properties",
  }),
};

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

  return (
    <>
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
