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

/** Meaningful alt for listing photos — prefers stored featured alt, then title/location. */
export function getPropertyImageAlt(
  property: Pick<
    PropertyListItem,
    | "title"
    | "neighborhood_name"
    | "district_name"
    | "bedrooms"
    | "property_type_name"
    | "primary_image_alt"
  >,
): string {
  const storedAlt = property.primary_image_alt?.trim();
  if (storedAlt) return storedAlt;
  const title = property.title?.trim();
  const place = [property.neighborhood_name, property.district_name].filter(Boolean).join(", ");
  if (title) {
    const hood = (property.neighborhood_name || "").toLowerCase();
    if (hood && !title.toLowerCase().includes(hood) && place) {
      return `${title} in ${place}`;
    }
    return title;
  }
  const beds = property.bedrooms != null ? `${property.bedrooms}-bedroom ` : "";
  const type = property.property_type_name ? `${property.property_type_name} ` : "property ";
  if (place) return `${beds}${type}in ${place}`.replace(/\s+/g, " ").trim();
  return "Property listing";
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
    { label: "Property Type", value: property.property_type_name ?? "" },
    { label: "Listing Type", value: property.listing_type ? property.listing_type.charAt(0).toUpperCase() + property.listing_type.slice(1) : "" },
    { label: "Furnished", value: formatYesNo(property.is_furnished) ?? "" },
    { label: "Bedrooms", value: property.bedrooms != null ? String(property.bedrooms) : "" },
    { label: "Bathrooms", value: property.bathrooms != null ? String(property.bathrooms) : "" },
    { label: "Living area", value: formatArea(property.area_sqm) ?? "" },
    { label: "Plot area", value: formatArea(property.lot_size_sqm) ?? "" },
    { label: "Parking spaces", value: property.parking_spaces != null ? String(property.parking_spaces) : "" },
    { label: "Parking", value: formatYesNo(property.has_parking) ?? "" },
    { label: "Kitchen", value: formatYesNo(property.has_kitchen) ?? "" },
    { label: "Pool", value: formatYesNo(property.has_pool) ?? "" },
    { label: "Jacuzzi", value: formatYesNo(property.has_jacuzzi) ?? "" },
    { label: "Garden", value: formatYesNo(property.has_garden) ?? "" },
    { label: "Balcony", value: formatYesNo(property.has_balcony) ?? "" },
    { label: "Pets allowed", value: formatYesNo(property.pets_allowed) ?? "" },
    { label: "Title deed", value: formatYesNo(property.has_title_deed) ?? "" },
    { label: "Year built", value: property.year_built != null ? String(property.year_built) : "" },
    { label: "Floors", value: property.floors != null ? String(property.floors) : "" },
    { label: "Published", value: property.published_at ? new Date(property.published_at).toLocaleDateString("en-GB") : "" },
  ];

  return rows.filter((row) => row.value.trim().length > 0);
}

export function buildPropertyFaqs(property: PropertyDetail): { id: string; question: string; answer: string; category?: string }[] {
  const faqs: { id: string; question: string; answer: string; category?: string }[] = [];
  const loc = [property.neighborhood_name, property.district_name].filter(Boolean).join(", ") || "Kigali";
  const title = property.title || "this property";

  faqs.push({
    id: `faq-${property.id}-location`,
    question: `Where is ${title} located?`,
    answer: `<p>This property is located in ${loc}. ${property.address ? `The full address is ${property.address}.` : ""}</p>`,
    category: "Location",
  });

  if (property.bedrooms != null || property.bathrooms != null) {
    const specs = [
      property.bedrooms != null ? `${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}` : null,
      property.bathrooms != null ? `${property.bathrooms} bathroom${property.bathrooms === 1 ? "" : "s"}` : null,
    ].filter(Boolean).join(" and ");
    faqs.push({
      id: `faq-${property.id}-size`,
      question: `How many bedrooms and bathrooms does ${title} have?`,
      answer: `<p>${specs ? `This property has ${specs}.` : ""} ${property.area_sqm ? `The total living area is ${property.area_sqm} m².` : ""} ${property.lot_size_sqm ? `The plot size is ${property.lot_size_sqm} m².` : ""}</p>`,
      category: "Property Details",
    });
  }

  faqs.push({
    id: `faq-${property.id}-furnished`,
    question: `Is ${title} furnished?`,
    answer: `<p>${property.is_furnished ? "Yes, this property is fully furnished." : "No, this property is let unfurnished."} If you would like to know more about the furniture or fixtures included, please contact us via WhatsApp or the inquiry form.</p>`,
    category: "Property Details",
  });

  faqs.push({
    id: `faq-${property.id}-price`,
    question: `What is the rent or sale price of ${title}?`,
    answer: `<p>The asking price is available on this listing page. The currency is ${property.currency || "USD"}. ${property.previous_price != null && property.previous_price > property.price ? "The price has recently been reduced." : ""} Final pricing, deposit terms, and payment schedule can be confirmed with the listing agent during a viewing or inquiry.</p>`,
    category: "Pricing",
  });

  const amenities: string[] = [];
  if (property.has_pool) amenities.push("a swimming pool");
  if (property.has_jacuzzi) amenities.push("a jacuzzi");
  if (property.has_garden) amenities.push("a garden");
  if (property.has_balcony) amenities.push("a balcony");
  if (property.has_kitchen) amenities.push("a kitchen");
  if (property.has_parking || (property.parking_spaces != null && property.parking_spaces > 0)) amenities.push("parking");
  if (property.pets_allowed) amenities.push("pet-friendly accommodation");
  if (amenities.length > 0 || (property.amenities?.length ?? 0) > 0) {
    const allAmenities = [...amenities, ...(property.amenities ?? [])];
    faqs.push({
      id: `faq-${property.id}-amenities`,
      question: `What amenities are available at ${title}?`,
      answer: `<p>This property features: ${allAmenities.join(", ")}. Additional details about amenities and included services can be confirmed with the agent.</p>`,
      category: "Amenities",
    });
  }

  faqs.push({
    id: `faq-${property.id}-viewing`,
    question: `Can I schedule a viewing for ${title}?`,
    answer: `<p>Yes. Use the "Schedule Viewing" button on this page to book a time, or send us a WhatsApp inquiry and we will arrange a viewing at your convenience. We recommend booking viewings at least 24 hours in advance.</p>`,
    category: "Viewing",
  });

  faqs.push({
    id: `faq-${property.id}-availability`,
    question: `Is ${title} still available?`,
    answer: `<p>${property.is_available !== false ? "Yes, this listing is currently marked as available. Availability changes regularly, so we recommend confirming with the agent before planning a viewing." : "This property is no longer marked as available. Please see similar properties recommended below, or contact us for alternatives in the same area."} ${property.availability_note || ""}</p>`,
    category: "Availability",
  });

  faqs.push({
    id: `faq-${property.id}-deposit`,
    question: `What is the deposit and payment process for renting in Kigali?`,
    answer: `<p>Standard terms for rentals in Kigali typically involve a security deposit (often one or two months' rent) plus the first month's rent in advance. The exact amount, payment methods, and lease terms (e.g., 6-month or 12-month minimum) are confirmed with the landlord or agent prior to signing. We can walk you through the full process when you inquire about this property.</p>`,
    category: "Rental Process",
  });

  return faqs;
}
