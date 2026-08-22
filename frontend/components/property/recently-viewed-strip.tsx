"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PropertyCard } from "@/components/property/property-card";
import { HighlightLabel } from "@/components/ui/highlight-label";
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
    <section className="py-12 px-6 bg-cream/60 dark:bg-secondary/40">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-navy-800 dark:text-white">
                {title}
              </h2>
              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-navy-800 hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/10 transition shrink-0"
                aria-label="Remove recently viewed"
                title="Remove recently viewed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">Pick up where you left off.</p>
          </div>
          <Link href="/favorites" className="text-sm shrink-0 hover:opacity-90 mt-1">
            <HighlightLabel className="text-gold-700 dark:text-gold-400">
              My Favorites →
            </HighlightLabel>
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {items.map((p, index) => (
            <div key={p.id} className={index > 0 ? "hidden lg:block" : undefined}>
              <PropertyCard property={toListItem(p)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
