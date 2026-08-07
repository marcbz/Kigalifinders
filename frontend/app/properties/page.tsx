import { Suspense } from "react";
import { fetchPropertiesSafe } from "@/lib/server-api";
import { PropertyCard } from "@/components/property/property-card";
import { SearchBar } from "@/components/search/search-bar";
import { ActivePropertyFilters } from "@/components/search/active-property-filters";

export const revalidate = 60;

export const metadata = {
  title: "Properties",
  description: "Browse luxury houses, apartments, and plots for sale in Kigali.",
};

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function PropertiesPage({ searchParams }: Props) {
  const params = await searchParams;
  const listingType = params.listing_type;
  const data = await fetchPropertiesSafe({
    q: params.q,
    listing_type: listingType && listingType !== "all" ? listingType : undefined,
    district_id: params.district_id,
    neighborhood_id: params.neighborhood_id,
    neighborhood_slug: params.neighborhood_slug,
    property_type_id: params.property_type_id,
    property_type_slug: params.property_type_slug,
    bedrooms: params.bedrooms ? parseInt(params.bedrooms) : undefined,
    min_price: params.min_price ? parseFloat(params.min_price) : undefined,
    max_price: params.max_price ? parseFloat(params.max_price) : undefined,
    sort_by: params.sort_by || "created_at",
    sort_order: params.sort_order || "desc",
    page: params.page ? parseInt(params.page) : 1,
    page_size: listingType === "furnished" ? 100 : 12,
  });

  return (
    <>
      <div className="bg-navy-800 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">BROWSE LISTINGS</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-3">All Properties</h1>
        </div>
      </div>
      <Suspense fallback={<div className="h-40 -mt-16" />}>
        <SearchBar />
      </Suspense>
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={null}>
            <ActivePropertyFilters />
          </Suspense>
          <p className="text-gray-500 mb-8">{data.total} properties found</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {data.items.map((property, i) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
          {data.items.length === 0 && (
            <p className="text-center text-gray-500 py-20">No properties found. Try adjusting your filters.</p>
          )}
        </div>
      </section>
    </>
  );
}
