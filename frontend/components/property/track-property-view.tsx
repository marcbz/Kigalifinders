"use client";

import { useEffect } from "react";
import { toSavedSnapshot, trackRecentlyViewed } from "@/lib/property-memory";
import { scheduleQualifiedView } from "@/lib/qualified-view";
import type { PropertyDetail } from "@/types";

export function TrackPropertyView({ property }: { property: PropertyDetail }) {
  useEffect(() => {
    trackRecentlyViewed(
      toSavedSnapshot({
        id: property.id,
        title: property.title,
        slug: property.slug,
        primary_image: property.primary_image || property.images?.[0]?.url,
        price: property.price,
        currency: property.currency,
        price_period: property.price_period,
        listing_type: property.listing_type,
        neighborhood_name: property.neighborhood_name,
        district_name: property.district_name,
        previous_price: property.previous_price,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        area_sqm: property.area_sqm,
        lot_size_sqm: property.lot_size_sqm,
        is_furnished: property.is_furnished,
        has_title_deed: property.has_title_deed,
        property_type_name: property.property_type_name,
      }),
    );
  }, [property]);

  useEffect(() => scheduleQualifiedView("property", property.slug), [property.slug]);

  return null;
}
