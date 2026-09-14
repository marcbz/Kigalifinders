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
    { label: "Year built", value: property.year_built != null ? String(property.year_built) : "" },
    { label: "Floors", value: property.floors != null ? String(property.floors) : "" },
  ];

  return rows.filter((row) => row.value.trim().length > 0);
}

export function buildPropertyFaqs(property: PropertyDetail): { id: string; question: string; answer: string; category?: string }[] {
  const faqs: { id: string; question: string; answer: string; category?: string }[] = [];
  const hood = property.neighborhood_name ? property.neighborhood_name.trim() : "";
  const district = property.district_name ? property.district_name.trim() : "";
  const loc = [hood, district].filter(Boolean).join(", ") || "Kigali";
  const title = property.title || "this property";

  const hoodContext: Record<string, string> = {
    kicukiro: "Kicukiro is a popular residential district in eastern Kigali, well connected to the city centre and Kigali International Airport.",
    nyarutarama: "Nyarutarama is an upscale, green neighbourhood in Kigali popular with families and expatriates, close to the Golf Club.",
    gacuriro: "Gacuriro is a sought-after, quiet residential area in Kigali known for its modern homes, good roads, and proximity to supermarkets and schools.",
    gisozi: "Gisozi is a central residential area in Kigali, close to main amenities and within easy reach of the Central Business District.",
    kagarama: "Kagarama is a residential area in Kicukiro district, Kigali, favoured for its accessibility and mix of apartment and house options.",
    kibagabaga: "Kibagabaga is a residential area in Gasabo district, Kigali, with a mix of apartments and family homes close to local services.",
    kimironko: "Kimironko is a vibrant residential area in Gasabo district, Kigali, home to a large local market and good road links.",
    rebero: "Rebero is a quiet, residential neighbourhood in Kigali popular for its fresh air, hilltop views, and family-sized housing stock.",
  };

  const contextHints: string[] = [];
  const hoodKey = hood.toLowerCase();
  if (hoodContext[hoodKey]) contextHints.push(hoodContext[hoodKey]);
  if (district && !contextHints.length) {
    const distKey = district.toLowerCase();
    if (hoodContext[distKey]) contextHints.push(hoodContext[distKey]);
  }

  faqs.push({
    id: `faq-${property.id}-location`,
    question: `Where exactly is ${title} located in Kigali?`,
    answer: `<p>${property.title} is located in ${loc}, Rwanda. ${property.address ? `The address on record is ${property.address}. ` : ""}${contextHints.join(" ")} If you would like exact directions or landmark references, please send us a WhatsApp message or book a viewing.</p>`,
    category: "Location",
  });

  const specsParts: string[] = [];
  if (property.bedrooms != null) specsParts.push(`${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}`);
  if (property.bathrooms != null) specsParts.push(`${property.bathrooms} bathroom${property.bathrooms === 1 ? "" : "s"}`);
  if (property.area_sqm != null) specsParts.push(`a ${property.area_sqm} m² living area`);
  if (property.lot_size_sqm != null && property.lot_size_sqm !== property.area_sqm) specsParts.push(`sitting on a ${property.lot_size_sqm} m² plot`);
  if (property.parking_spaces != null && property.parking_spaces > 0) specsParts.push(`${property.parking_spaces} covered parking space${property.parking_spaces === 1 ? "" : "s"}`);
  if (property.year_built != null) specsParts.push(`constructed around ${property.year_built}`);
  if (property.floors != null && property.floors > 1) specsParts.push(`${property.floors} floors`);
  const specSentence = specsParts.length
    ? specsParts.slice(0, -1).join(", ") + (specsParts.length > 1 ? ` and ${specsParts[specsParts.length - 1]}` : "")
    : "";
  faqs.push({
    id: `faq-${property.id}-specs`,
    question: `What are the main specifications of ${title}?`,
    answer: `<p>${property.title} in ${loc} offers ${specSentence || "a range of accommodation features designed for comfortable living in Kigali"}. ${property.is_furnished ? "The property comes fully furnished — kitchen appliances, wardrobes, seating and bedroom furniture are all included in the listing." : "The property is let unfurnished, so you can move in with your own furniture and personal effects."} ${property.property_type_name ? `The listing is categorised as a ${property.property_type_name}.` : ""}</p>`,
    category: "Property Details",
  });

  const amList: string[] = [];
  if (property.has_pool) amList.push("swimming pool");
  if (property.has_jacuzzi) amList.push("jacuzzi / hot tub");
  if (property.has_garden) amList.push("private garden");
  if (property.has_balcony) amList.push("balcony or terrace");
  if (property.has_kitchen) amList.push("fitted kitchen");
  if (property.has_parking || (property.parking_spaces != null && property.parking_spaces > 0)) amList.push("secure on-site parking");
  if (property.pets_allowed) amList.push("pet-friendly policy");
  if (property.amenities?.length) amList.push(...property.amenities.map((a) => a.toLowerCase()));
  faqs.push({
    id: `faq-${property.id}-amenities`,
    question: `What amenities and features does ${title} include?`,
    answer: `<p>Key amenities included with ${property.title} in ${loc}: ${amList.length ? amList.join(", ") + "." : "standard residential features suitable for rental living in Kigali."} ${property.has_title_deed ? "The property has a title deed, providing clear ownership documentation for the transaction." : ""} For a full walkthrough of the finishes, fixtures and services included, we recommend an in-person viewing or a video call with our agent.</p>`,
    category: "Amenities",
  });

  const price = property.price;
  const currency = property.currency || "USD";
  const period = property.listing_type === "sale" ? null : property.price_period;
  const reduced = property.previous_price != null && property.previous_price > price;
  const listingKind = property.listing_type === "sale" ? "sale listing" : "rental";
  faqs.push({
    id: `faq-${property.id}-pricing`,
    question: `What is the current price and availability of ${title}?`,
    answer: `<p>${property.title} in ${loc} is a ${listingKind} priced at ${price.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 })}${period ? ` per ${period}` : ""}. ${reduced ? "The asking price has recently been reduced from the previous listing, making this an opportune moment to inquire." : "The price shown is the current advertised rate."} ${property.is_available !== false ? "The listing is currently marked as available on Kigali Rent." : "At the moment this listing is not marked as available — please contact us for comparable alternatives in the same area."} ${property.availability_note || ""} Final terms, deposit amount and any negotiable items should be discussed directly with the listing agent.</p>`,
    category: "Pricing & Availability",
  });

  return faqs.slice(0, 4);
}
