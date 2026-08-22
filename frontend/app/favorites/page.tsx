"use client";

import { useEffect, useState } from "react";
import { PropertyCard } from "@/components/property/property-card";
import { getFavorites, type SavedPropertySnapshot } from "@/lib/property-memory";
import type { PropertyListItem } from "@/types";
import Link from "next/link";

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

export default function FavoritesPage() {
  const [items, setItems] = useState<SavedPropertySnapshot[]>([]);

  useEffect(() => {
    const load = () => setItems(getFavorites());
    load();
    window.addEventListener("kigalirent-storage", load);
    return () => window.removeEventListener("kigalirent-storage", load);
  }, []);

  return (
    <>
      <div className="bg-navy-800 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">FAVORITES</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-3">My Favorites</h1>
          <p className="text-gray-300 mt-3 text-sm">Saved on this device — heart a listing to add it here.</p>
        </div>
      </div>
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 mb-4">No favorites yet.</p>
              <Link href="/properties" className="text-gold-600 hover:underline">
                Browse listings →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {items.map((p) => (
                <PropertyCard key={p.id} property={toListItem(p)} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
