import { PropertyGridSkeleton } from "@/components/ui/shimmer";
import { SearchBarPlaceholder } from "@/components/search/search-bar-placeholder";

export default function PropertiesLoading() {
  return (
    <>
      <div className="bg-navy-800 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">BROWSE LISTINGS</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-3">All Properties</h1>
        </div>
      </div>
      <SearchBarPlaceholder />
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <PropertyGridSkeleton />
        </div>
      </section>
    </>
  );
}
