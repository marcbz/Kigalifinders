import type { PropertyDetail } from "@/types";

export function buildPropertyListingJsonLd(property: PropertyDetail, propertyUrl: string) {
  const price = property.usd_price ?? property.price;
  const addressParts: Record<string, string> = {
    "@type": "PostalAddress",
    addressCountry: "RW",
  };
  if (property.address) addressParts.streetAddress = property.address;
  if (property.neighborhood_name) addressParts.addressLocality = property.neighborhood_name;
  if (property.district_name) addressParts.addressRegion = property.district_name;

  const fullDescRaw = [property.short_description, property.description]
    .filter((s) => s && s.trim().length > 0)
    .map((s) => s!.replace(/\s+/g, " ").trim())
    .join(" ");
  const fullDescription = fullDescRaw.slice(0, 5000);

  const listing: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": `${propertyUrl}#listing`,
    url: propertyUrl,
    name: property.title,
    headline: property.title,
    description: fullDescription || property.title,
    keywords: [
      property.property_type_name,
      property.neighborhood_name,
      property.district_name,
      property.listing_type === "sale" ? "house for sale Kigali" : "apartment for rent Kigali",
      property.bedrooms != null ? `${property.bedrooms} bedroom` : null,
    ]
      .filter(Boolean) as string[],
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: property.currency || "USD",
      availability:
        property.is_available !== false
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      businessFunction:
        property.listing_type === "sale" ? "http://purl.org/goodrelations/v1#Sell" : "http://purl.org/goodrelations/v1#LeaseOut",
    },
  };

  if (property.published_at) {
    listing.datePosted = property.published_at;
    listing.dateModified = property.last_verified_at || property.created_at || property.published_at;
  }
  if (Object.keys(addressParts).length > 2) listing.address = addressParts;
  if (property.latitude != null && property.longitude != null) {
    listing.geo = {
      "@type": "GeoCoordinates",
      latitude: property.latitude,
      longitude: property.longitude,
    };
  }
  if (property.bedrooms != null) listing.numberOfRooms = property.bedrooms;
  if (property.bathrooms != null) listing.numberOfBathroomsTotal = property.bathrooms;
  if (property.is_furnished) {
    listing.furnished = true;
  }
  if (property.area_sqm) listing.floorSize = { "@type": "QuantitativeValue", value: property.area_sqm, unitCode: "MTK" };
  if (property.lot_size_sqm) listing.lotSize = { "@type": "QuantitativeValue", value: property.lot_size_sqm, unitCode: "MTK" };
  if (property.year_built) listing.yearBuilt = property.year_built;

  const propertyTypeMap: Record<string, string> = {
    apartment: "Apartment",
    house: "House",
    villa: "House",
    plot: "Land",
    land: "Land",
    office: "Office",
    commercial: "CommercialProperty",
    studio: "Apartment",
    penthouse: "Apartment",
  };
  let schemaPropertyType = "Accommodation";
  if (property.property_type_name) {
    const key = property.property_type_name.toLowerCase();
    for (const k in propertyTypeMap) {
      if (key.includes(k)) {
        schemaPropertyType = propertyTypeMap[k];
        break;
      }
    }
  }

  const place: Record<string, unknown> = {
    "@type": schemaPropertyType,
    name: property.title,
    address: Object.keys(addressParts).length > 2 ? addressParts : undefined,
  };
  if (property.property_type_name) place.description = `${property.property_type_name} in ${[property.neighborhood_name, property.district_name].filter(Boolean).join(", ") || "Kigali"}, Rwanda.`;
  if (property.bedrooms != null) (place as Record<string, unknown>).numberOfRooms = property.bedrooms;
  if (property.bathrooms != null) (place as Record<string, unknown>).numberOfBathroomsTotal = property.bathrooms;
  if (property.area_sqm) (place as Record<string, unknown>).floorSize = listing.floorSize;
  if (property.lot_size_sqm) (place as Record<string, unknown>).lotSize = listing.lotSize;
  if (property.year_built) (place as Record<string, unknown>).yearBuilt = property.year_built;
  if (property.has_title_deed != null) {
    (place as Record<string, unknown>).additionalProperty = [
      { "@type": "PropertyValue", name: "titleDeed", value: property.has_title_deed ? "Yes" : "No" },
    ];
  }
  listing.itemOffered = place;

  const listingTypeLabel =
    property.listing_type === "sale"
      ? "For Sale"
      : property.listing_type === "furnished"
        ? "Furnished Rental"
        : property.listing_type === "unfurnished"
          ? "Unfurnished Rental"
          : property.listing_type ?? "Rental";
  listing.disambiguatingDescription = `${listingTypeLabel} in ${[property.neighborhood_name, property.district_name].filter(Boolean).join(", ") || "Kigali"}, Rwanda. ${fullDescription.slice(0, 240)}`;

  const amenities: string[] = [];
  if (property.has_pool) amenities.push("Swimming pool");
  if (property.has_parking) amenities.push("Parking");
  if (property.has_garden) amenities.push("Garden");
  if (property.has_balcony) amenities.push("Balcony");
  if (property.pets_allowed) amenities.push("Pets allowed");
  if (property.has_kitchen) amenities.push("Kitchen");
  if (property.has_jacuzzi) amenities.push("Hot tub");
  if (property.amenities?.length) amenities.push(...property.amenities);
  if (amenities.length) {
    listing.amenityFeature = amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name }));
  }

  const addProp: Record<string, unknown>[] = [];
  if (property.property_type_name) {
    addProp.push({ "@type": "PropertyValue", name: "propertyType", value: property.property_type_name });
  }
  if (property.listing_type) {
    addProp.push({ "@type": "PropertyValue", name: "listingType", value: property.listing_type });
  }
  if (property.has_title_deed != null) {
    addProp.push({ "@type": "PropertyValue", name: "titleDeedAvailable", value: property.has_title_deed });
  }
  if (property.published_at) {
    addProp.push({ "@type": "PropertyValue", name: "listingPublishedDate", value: property.published_at });
  }
  if (property.agent_name) {
    addProp.push({ "@type": "PropertyValue", name: "listingAgent", value: property.agent_name });
  }
  if (addProp.length) {
    listing.additionalProperty = addProp;
  }

  if (property.primary_image) {
    listing.image = {
      "@type": "ImageObject",
      url: property.primary_image,
      caption: property.primary_image_alt || property.title,
    };
  }

  return listing;
}
