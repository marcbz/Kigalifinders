"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { locationService } from "@/services/api";
import { neighborhoodFilterLabel } from "@/lib/neighborhood-groups";

export function ActivePropertyFilters() {
  const searchParams = useSearchParams();
  const neighborhoodId = searchParams.get("neighborhood_id");
  const neighborhoodSlug = searchParams.get("neighborhood_slug");
  const listingType = searchParams.get("listing_type");
  const propertyTypeSlug = searchParams.get("property_type_slug");

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: locationService.neighborhoods,
  });

  const matched =
    neighborhoods.find((n: { id: string }) => n.id === neighborhoodId) ||
    (neighborhoodSlug
      ? neighborhoods.find((n: { slug: string }) => n.slug === neighborhoodSlug)
      : undefined);

  const chips: string[] = [];
  if (matched) {
    chips.push(
      `Neighborhood: ${neighborhoodFilterLabel(matched.name, matched.slug)}`,
    );
  }
  if (listingType === "furnished") chips.push("Furnished");
  if (listingType === "sale") chips.push("For Sale");
  if (listingType === "rent") chips.push("For Rent");
  if (propertyTypeSlug === "plot") chips.push("Plots");

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {chips.map((chip) => (
        <span
          key={chip}
          className="px-3 py-1.5 bg-cream dark:bg-secondary text-navy-800 dark:text-white rounded-full text-sm font-medium border border-gold-500/30"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}
