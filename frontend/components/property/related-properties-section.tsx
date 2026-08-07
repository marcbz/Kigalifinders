"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { propertyService } from "@/services/api";
import { PropertyCard } from "@/components/property/property-card";

export function RelatedPropertiesSection({ slug }: { slug: string }) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["related-properties", slug],
    queryFn: ({ pageParam = 1 }) => propertyService.related(slug, pageParam, 12),
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
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const properties = data?.pages.flatMap((page) => page.items) ?? [];

  if (!isLoading && properties.length === 0) return null;

  return (
    <section className="py-16 px-6 bg-cream dark:bg-secondary">
      <div className="max-w-7xl mx-auto">
        <h2 className="font-serif text-3xl font-bold text-navy-800 dark:text-white mb-2">
          Related Properties
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Browse all available listings — for rent and for sale.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {properties.map((property, i) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
        {isLoading && (
          <p className="text-center text-gray-500 py-12">Loading properties…</p>
        )}
        <div ref={loadMoreRef} className="h-4" />
        {isFetchingNextPage && (
          <p className="text-center text-gray-500 py-6">Loading more…</p>
        )}
      </div>
    </section>
  );
}
