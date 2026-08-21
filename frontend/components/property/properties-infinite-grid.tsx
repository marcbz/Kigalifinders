"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { propertyService } from "@/services/api";
import { PropertyCard } from "@/components/property/property-card";
import type { PropertySearchParams } from "@/types";

const PAGE_SIZE = 12;

function buildListParams(searchParams: URLSearchParams, page: number): PropertySearchParams {
  const listingType = searchParams.get("listing_type") || undefined;
  const bedrooms = searchParams.get("bedrooms");
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");

  return {
    q: searchParams.get("q") || undefined,
    listing_type: listingType && listingType !== "all" ? listingType : undefined,
    district_id: searchParams.get("district_id") || undefined,
    neighborhood_id: searchParams.get("neighborhood_id") || undefined,
    neighborhood_slug: searchParams.get("neighborhood_slug") || undefined,
    property_type_id: searchParams.get("property_type_id") || undefined,
    property_type_slug: searchParams.get("property_type_slug") || undefined,
    bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
    min_price: minPrice ? parseFloat(minPrice) : undefined,
    max_price: maxPrice ? parseFloat(maxPrice) : undefined,
    sort_by: searchParams.get("sort_by") || "created_at",
    sort_order: searchParams.get("sort_order") || "desc",
    page,
    page_size: PAGE_SIZE,
  };
}

export function PropertiesInfiniteGrid() {
  const searchParams = useSearchParams();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const filterKey = searchParams.toString();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
    queryKey: ["properties-list", filterKey],
    queryFn: ({ pageParam = 1 }) =>
      propertyService.list(buildListParams(searchParams, pageParam as number)),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const properties = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <>
      <p className="text-gray-500 mb-8">
        {isLoading ? "Loading properties…" : `${total} properties found`}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
      {!isLoading && properties.length === 0 && !isError && (
        <p className="text-center text-gray-500 py-20">No properties found. Try adjusting your filters.</p>
      )}
      {isError && (
        <p className="text-center text-red-500 py-20">Could not load properties. Please try again.</p>
      )}
      <div ref={loadMoreRef} className="h-4" aria-hidden />
      {isFetchingNextPage && <p className="text-center text-gray-500 py-6">Loading more…</p>}
      {!hasNextPage && properties.length > 0 && (
        <p className="text-center text-gray-400 text-sm py-6">You&apos;ve reached the end of the list.</p>
      )}
    </>
  );
}
