import { formatPrice } from "@/lib/utils";
import type { PropertyListItem } from "@/types";

export type AreaListingStats = {
  total: number;
  rentCount: number;
  saleCount: number;
  furnishedCount: number;
  rentRangeLabel: string | null;
  bedroomSummary: string | null;
  typeSummary: string | null;
};

function monthlyRentListings(properties: PropertyListItem[]) {
  return properties.filter(
    (p) =>
      (p.listing_type === "rent" || p.listing_type === "furnished") &&
      typeof p.price === "number" &&
      p.price > 0 &&
      (p.price_period === "month" || !p.price_period),
  );
}

export function buildAreaListingStats(properties: PropertyListItem[]): AreaListingStats {
  const rent = monthlyRentListings(properties);
  const sale = properties.filter((p) => p.listing_type === "sale" && p.price > 0);
  const furnished = properties.filter((p) => p.listing_type === "furnished" || p.is_furnished);

  let rentRangeLabel: string | null = null;
  if (rent.length >= 2) {
    const prices = rent.map((p) => p.price).sort((a, b) => a - b);
    const currency = rent[0].currency || "USD";
    rentRangeLabel = `${formatPrice(prices[0], currency)}–${formatPrice(prices[prices.length - 1], currency)} per month across ${rent.length} current Kigali Rent listings`;
  } else if (rent.length === 1) {
    const p = rent[0];
    rentRangeLabel = `One current rental listed at ${formatPrice(p.price, p.currency || "USD")}/mo — too few listings to describe a typical range`;
  }

  const bedroomCounts = new Map<number, number>();
  for (const p of properties) {
    if (p.bedrooms == null) continue;
    bedroomCounts.set(p.bedrooms, (bedroomCounts.get(p.bedrooms) || 0) + 1);
  }
  const bedroomSummary =
    bedroomCounts.size > 0
      ? Array.from(bedroomCounts.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([beds, count]) => `${count} × ${beds}-bedroom`)
          .join(", ")
      : null;

  const typeCounts = new Map<string, number>();
  for (const p of properties) {
    const name = p.property_type_name?.trim();
    if (!name) continue;
    typeCounts.set(name, (typeCounts.get(name) || 0) + 1);
  }
  const typeSummary =
    typeCounts.size > 0
      ? Array.from(typeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => `${name} (${count})`)
          .join(", ")
      : null;

  return {
    total: properties.length,
    rentCount: rent.length,
    saleCount: sale.length,
    furnishedCount: furnished.length,
    rentRangeLabel,
    bedroomSummary,
    typeSummary,
  };
}
