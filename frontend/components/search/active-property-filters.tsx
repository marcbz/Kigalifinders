"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { locationService } from "@/services/api";
import { neighborhoodFilterLabel } from "@/lib/neighborhood-groups";

function formatPriceChip(min: string | null, max: string | null): string | null {
  const minN = min ? parseFloat(min) : null;
  const maxN = max ? parseFloat(max) : null;
  if (minN == null && maxN == null) return null;
  if (minN != null && maxN != null) {
    if (minN <= 0) return `Under $${maxN.toLocaleString()}`;
    if (!maxN) return `$${minN.toLocaleString()}+`;
    return `$${minN.toLocaleString()} – $${maxN.toLocaleString()}`;
  }
  if (maxN != null) return `Under $${maxN.toLocaleString()}`;
  return `$${minN!.toLocaleString()}+`;
}

export function ActivePropertyFilters() {
  const searchParams = useSearchParams();
  const neighborhoodId = searchParams.get("neighborhood_id");
  const neighborhoodSlug = searchParams.get("neighborhood_slug");
  const listingType = searchParams.get("listing_type");
  const propertyTypeId = searchParams.get("property_type_id");
  const propertyTypeSlug = searchParams.get("property_type_slug");
  const bedrooms = searchParams.get("bedrooms");
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: locationService.neighborhoods,
  });

  const { data: propertyTypes = [] } = useQuery({
    queryKey: ["property-types"],
    queryFn: locationService.propertyTypes,
  });

  const matched =
    neighborhoods.find((n: { id: string }) => n.id === neighborhoodId) ||
    (neighborhoodSlug
      ? neighborhoods.find((n: { slug: string }) => n.slug === neighborhoodSlug)
      : undefined);

  const matchedType =
    propertyTypes.find((pt: { id: string }) => pt.id === propertyTypeId) ||
    (propertyTypeSlug
      ? propertyTypes.find((pt: { slug: string }) => pt.slug === propertyTypeSlug)
      : undefined);

  const chips: string[] = [];
  if (matched) {
    chips.push(
      `Neighborhood: ${neighborhoodFilterLabel(matched.name, matched.slug)}`,
    );
  }
  if (listingType === "furnished" || listingType === "rent") chips.push("For Rent");
  if (listingType === "sale") chips.push("For Sale");
  if (matchedType) chips.push(matchedType.name);
  else if (propertyTypeSlug === "plot") chips.push("Plots");
  if (bedrooms) chips.push(`${bedrooms}+ bedrooms`);
  const priceChip = formatPriceChip(minPrice, maxPrice);
  if (priceChip) chips.push(priceChip);

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
