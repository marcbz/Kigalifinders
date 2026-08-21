"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PropertyCard } from "@/components/property/property-card";
import { getRecentlyViewed, type SavedPropertySnapshot } from "@/lib/property-memory";
import type { PropertyListItem } from "@/types";

function toListItem(p: SavedPropertySnapshot): PropertyListItem {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    listing_type: p.listing_type,
    status: "published",
    price: p.price,
    previous_price: p.previous_price ?? undefined,
    currency: p.currency,
    price_period: p.price_period ?? undefined,
    is_featured: false,
    is_premium: false,
    is_furnished: p.is_furnished ?? false,
    has_title_deed: p.has_title_deed ?? false,
    primary_image: p.primary_image ?? undefined,
    neighborhood_name: p.neighborhood_name ?? undefined,
    district_name: p.district_name ?? undefined,
    bedrooms: p.bedrooms ?? undefined,
    bathrooms: p.bathrooms ?? undefined,
    area_sqm: p.area_sqm ?? undefined,
    lot_size_sqm: p.lot_size_sqm ?? undefined,
    property_type_name: p.property_type_name ?? undefined,
  };
}

export function RecentlyViewedStrip({
  title = "Recently viewed",
  excludeId,
}: {
  title?: string;
  excludeId?: string;
}) {
  const [items, setItems] = useState<SavedPropertySnapshot[]>([]);

  useEffect(() => {
    const load = () => {
      setItems(getRecentlyViewed().filter((p) => p.id !== excludeId).slice(0, 6));
    };
    load();
    window.addEventListener("kigalirent-storage", load);
    return () => window.removeEventListener("kigalirent-storage", load);
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="py-12 px-6 bg-cream/60 dark:bg-secondary/40">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-navy-800 dark:text-white">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">Pick up where you left off.</p>
          </div>
          <Link href="/favorites" className="text-sm text-gold-600 hover:underline shrink-0">
            Saved homes →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((p) => (
            <PropertyCard key={p.id} property={toListItem(p)} />
          ))}
        </div>
      </div>
    </section>
  );
}
