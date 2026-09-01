"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { propertyService } from "@/services/api";
import { PropertyCard } from "@/components/property/property-card";
import { buildPropertyListParams } from "@/lib/property-search-params";

const PAGE_SIZE = 12;

export function PropertiesInfiniteGrid() {
  const searchParams = useSearchParams();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const filterKey = searchParams.toString();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
    queryKey: ["properties-list", filterKey],
    queryFn: ({ pageParam = 1 }) =>
      propertyService.list(buildPropertyListParams(searchParams, pageParam as number, PAGE_SIZE)),
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
