import type { PropertySearchParams } from "@/types";

export const BEDROOM_FILTER_OPTIONS = ["1+", "2+", "3+", "4+", "5+"] as const;

/** URL query value (e.g. `2`) → select value (`2+`). */
export function bedroomsSelectValueFromUrl(value: string | null | undefined): string {
  if (!value) return "";
  const n = parseInt(value.replace("+", ""), 10);
  if (Number.isNaN(n) || n < 1) return "";
  return `${n}+`;
}

/** Select value (`2+`) → URL query value (`2`). */
export function bedroomsUrlValueFromSelect(value: string | null | undefined): string | null {
  if (!value) return null;
  const n = parseInt(value.replace("+", ""), 10);
  if (Number.isNaN(n) || n < 1) return null;
  return String(n);
}

/** Parse bedrooms from URL for API calls (minimum count). */
export function parseBedroomsUrlParam(value: string | null | undefined): number | undefined {
  const normalized = bedroomsUrlValueFromSelect(bedroomsSelectValueFromUrl(value || ""));
  if (!normalized) return undefined;
  return parseInt(normalized, 10);
}

export function formatBedroomsFilterChip(value: string | null | undefined): string | null {
  const selectValue = bedroomsSelectValueFromUrl(value);
  if (!selectValue) return null;
  return `${selectValue} bedrooms`;
}

export function buildPropertyListParams(
  searchParams: URLSearchParams,
  page: number,
  pageSize: number,
): PropertySearchParams {
  const listingType = searchParams.get("listing_type") || undefined;

  return {
    q: searchParams.get("q") || undefined,
    listing_type: listingType && listingType !== "all" ? listingType : undefined,
    district_id: searchParams.get("district_id") || undefined,
    neighborhood_id: searchParams.get("neighborhood_id") || undefined,
    neighborhood_slug: searchParams.get("neighborhood_slug") || undefined,
    property_type_id: searchParams.get("property_type_id") || undefined,
    property_type_slug: searchParams.get("property_type_slug") || undefined,
    bedrooms: parseBedroomsUrlParam(searchParams.get("bedrooms")),
    min_price: searchParams.get("min_price") ? parseFloat(searchParams.get("min_price")!) : undefined,
    max_price: searchParams.get("max_price") ? parseFloat(searchParams.get("max_price")!) : undefined,
    sort_by: searchParams.get("sort_by") || "created_at",
    sort_order: searchParams.get("sort_order") || "desc",
    page,
    page_size: pageSize,
  };
}
