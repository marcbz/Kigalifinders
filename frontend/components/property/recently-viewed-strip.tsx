"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PropertyCard } from "@/components/property/property-card";
import {
  clearRecentlyViewed,
  getRecentlyViewed,
  type SavedPropertySnapshot,
} from "@/lib/property-memory";
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
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const load = () => {
      setItems(getRecentlyViewed().filter((p) => p.id !== excludeId).slice(0, 3));
    };
    load();
    window.addEventListener("kigalirent-storage", load);
    return () => window.removeEventListener("kigalirent-storage", load);
  }, [excludeId]);

  if (hidden || items.length === 0) return null;

  const handleDismiss = () => {
    setHidden(true);
    clearRecentlyViewed();
  };

  return (
    <section className="pt-8 pb-6 sm:pt-10 sm:pb-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto relative rounded-xl sm:rounded-2xl border border-gold-500/30 bg-cream/80 dark:bg-secondary/50 px-4 pt-7 pb-5 sm:px-8 sm:pt-9 sm:pb-10 shadow-sm">
        {/* Tab sits on the top border — half outside, half inside */}
        <Link
          href="/favorites"
          className="absolute left-1/2 -translate-x-1/2 -top-3 z-20 inline-flex items-center rounded-full border border-gold-500/50 bg-cream dark:bg-secondary px-3 py-1 text-[11px] sm:text-xs font-semibold text-navy-800 dark:text-gold-400 shadow-sm hover:bg-gold-500/15 dark:hover:bg-gold-500/20 transition"
        >
          My Favorites →
        </Link>

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-10 inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-navy-800 text-white shadow-md hover:bg-navy-900 dark:bg-gold-500 dark:text-navy-900 dark:hover:bg-gold-400 transition"
          aria-label="Remove recently viewed"
          title="Remove recently viewed"
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
        </button>

        <div className="mb-4 sm:mb-6 pr-10 sm:pr-12">
          <h2 className="font-serif text-lg sm:text-2xl md:text-3xl font-bold text-navy-800 dark:text-white leading-snug">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
            Pick up where you left off.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
          {items.map((p, index) => (
            <div key={p.id} className={index >= 2 ? "hidden lg:block" : undefined}>
              <PropertyCard property={toListItem(p)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
