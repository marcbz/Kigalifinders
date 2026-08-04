import type { PropertyDetail, PropertyListItem } from "@/types";

export type ListingBadge = "For Sale" | "Furnished" | "Unfurnished";

export function getListingBadge(
  property: Pick<PropertyListItem, "listing_type" | "is_furnished" | "property_type_name">,
): ListingBadge {
  const typeName = property.property_type_name?.toLowerCase() ?? "";
  const isPlot = typeName.includes("plot") || typeName.includes("land");
  if (property.listing_type === "sale" || isPlot) {
    return "For Sale";
  }
  if (property.listing_type === "furnished" || property.is_furnished) {
    return "Furnished";
  }
  return "Unfurnished";
}

export function getPropertyAreaLabel(
  property: Pick<PropertyListItem, "listing_type" | "property_type_name" | "area_sqm" | "lot_size_sqm">,
): string | null {
  const typeName = property.property_type_name?.toLowerCase() ?? "";
  const isLand = typeName.includes("plot") || typeName.includes("land");
  if ((isLand || property.listing_type === "sale") && property.lot_size_sqm) {
    return `${property.lot_size_sqm} m²`;
  }
  if (property.area_sqm) {
    return `${property.area_sqm} m²`;
  }
  if (property.lot_size_sqm) {
    return `${property.lot_size_sqm} m²`;
  }
  return null;
}

export function formatYesNo(value?: boolean | null): string | null {
  if (value == null) return null;
  return value ? "Yes" : "No";
}

export function formatArea(value?: number | null, unit = "m²"): string | null {
  if (value == null) return null;
  return `${value} ${unit}`;
}

export interface FeatureRow {
  label: string;
  value: string;
}

export function buildPropertyFeatureRows(property: PropertyDetail): FeatureRow[] {
  const realtor = property.realtor_name || property.agent_name;
  const rows: FeatureRow[] = [
    { label: "Realtor", value: realtor ?? "" },
    { label: "Furnished", value: formatYesNo(property.is_furnished) ?? "" },
    { label: "Balcony", value: formatYesNo(property.has_balcony) ?? "" },
    { label: "Plot area", value: formatArea(property.lot_size_sqm) ?? "" },
    { label: "Living area", value: formatArea(property.area_sqm) ?? "" },
    { label: "Kitchen", value: formatYesNo(property.has_kitchen) ?? "" },
    { label: "Bedrooms", value: property.bedrooms != null ? String(property.bedrooms) : "" },
    { label: "Pool", value: formatYesNo(property.has_pool) ?? "" },
    { label: "Bathrooms", value: property.bathrooms != null ? String(property.bathrooms) : "" },
    { label: "Parking", value: formatYesNo(property.has_parking) ?? "" },
    { label: "Jacuzzi", value: formatYesNo(property.has_jacuzzi) ?? "" },
    { label: "Garden", value: formatYesNo(property.has_garden) ?? "" },
    { label: "Pets allowed", value: formatYesNo(property.pets_allowed) ?? "" },
  ];

  return rows.filter((row) => row.value.trim().length > 0);
}
