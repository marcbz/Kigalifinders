import { Suspense } from "react";
import { SearchBar } from "@/components/search/search-bar";
import { SearchBarPlaceholder } from "@/components/search/search-bar-placeholder";
import { ActivePropertyFilters } from "@/components/search/active-property-filters";
import { PropertiesInfiniteGrid } from "@/components/property/properties-infinite-grid";
import { PropertyGridSkeleton } from "@/components/ui/shimmer";

export const metadata = {
  title: "Properties",
  description: "Browse luxury houses, apartments, and plots for sale in Kigali.",
};

export default function PropertiesPage() {
  return (
    <>
      <div className="bg-navy-800 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">BROWSE LISTINGS</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-3">All Properties</h1>
        </div>
      </div>
      <Suspense fallback={<SearchBarPlaceholder />}>
        <SearchBar />
      </Suspense>
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={null}>
            <ActivePropertyFilters />
          </Suspense>
          <Suspense fallback={<PropertyGridSkeleton count={6} />}>
            <PropertiesInfiniteGrid />
          </Suspense>
        </div>
      </section>
    </>
  );
}
