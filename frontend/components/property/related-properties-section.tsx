"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { propertyService } from "@/services/api";
import { PropertyCard } from "@/components/property/property-card";
import type { PaginatedResponse, PropertyListItem } from "@/types";

interface RelatedPropertiesSectionProps {
  slug: string;
  initialData?: PaginatedResponse<PropertyListItem>;
}

export function RelatedPropertiesSection({ slug, initialData }: RelatedPropertiesSectionProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const initialPage = initialData
    ? {
        pages: [initialData],
        pageParams: [1],
      }
    : undefined;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } = useInfiniteQuery({
    queryKey: ["related-properties", slug],
    queryFn: ({ pageParam = 1 }) => propertyService.related(slug, pageParam, 12),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    ...(initialData ? { initialData: initialPage } : {}),
    retry: initialData ? 0 : 1,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage && !isError) {
          fetchNextPage().catch(() => {});
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isError]);

  const properties = data?.pages.flatMap((page) => page.items) ?? [];

  const hasInitialItems = initialData && initialData.items.length > 0;
  const hasAny = properties.length > 0 || hasInitialItems;

  if (!isLoading && !isError && !hasAny) return null;
  if (isError && !hasInitialItems) return null;

  const displayProperties = properties.length > 0
    ? properties
    : (initialData?.items ?? []);

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
          {displayProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
        {isLoading && !initialData && (
          <div className="grid md:grid-cols-3 gap-8 mt-0">
            {[...Array(3)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-80 rounded-2xl bg-white/60 dark:bg-card/60 animate-pulse border border-gray-200 dark:border-border"
                aria-hidden
              />
            ))}
          </div>
        )}
        {isLoading && !initialData && displayProperties.length === 0 && (
          <p className="text-center text-gray-500 py-12">Loading properties…</p>
        )}
        {isError && initialData && (
          <p className="text-center text-gray-500 py-6 text-sm">
            Showing available listings. Some additional results could not load right now.
          </p>
        )}
        <div ref={loadMoreRef} className="h-4" />
        {isFetchingNextPage && !isError && (
          <p className="text-center text-gray-500 py-6">Loading more…</p>
        )}
        {isError && !initialData && (
          <p className="text-center text-gray-500 py-12">
            Related listings are temporarily unavailable. Please refresh or browse all properties.
          </p>
        )}
      </div>
    </section>
  );
}
