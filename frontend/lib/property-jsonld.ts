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

  const listing: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": `${propertyUrl}#listing`,
    url: propertyUrl,
    name: property.title,
    description: property.short_description || property.description,
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: property.currency || "USD",
      availability:
        property.is_available !== false
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  if (property.published_at) listing.datePosted = property.published_at;
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

  const amenities: string[] = [];
  if (property.has_pool) amenities.push("Swimming pool");
  if (property.has_parking) amenities.push("Parking");
  if (property.has_garden) amenities.push("Garden");
  if (property.has_balcony) amenities.push("Balcony");
  if (property.pets_allowed) amenities.push("Pets allowed");
  if (property.amenities?.length) amenities.push(...property.amenities);
  if (amenities.length) {
    listing.amenityFeature = amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name }));
  }

  if (property.primary_image) {
    listing.image = property.primary_image;
  }

  return listing;
}
