"use client";

import { Heart, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { PropertyListItem } from "@/types";
import { isFavorite, toggleFavorite, toSavedSnapshot } from "@/lib/property-memory";

export function PropertyCardActions({ property }: { property: PropertyListItem }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isFavorite(property.id));
    const sync = () => setSaved(isFavorite(property.id));
    window.addEventListener("kigalirent-storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("kigalirent-storage", sync);
      window.removeEventListener("storage", sync);
    };
  }, [property.id]);

  const onSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSaved(toggleFavorite(toSavedSnapshot(property)));
  };

  const onShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/properties/${property.slug}`;
    const text = `Check out ${property.title} on Kigali Rent: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: property.title, text, url });
        return;
      } catch {
        // fall through
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="absolute top-3.5 right-3.5 flex gap-2 z-10 pointer-events-auto">
      <button
        type="button"
        onClick={onSave}
        className={`w-9 h-9 rounded-full bg-white/95 flex items-center justify-center transition ${
          saved ? "text-red-500" : "text-navy-800 hover:bg-gold-500 hover:text-white"
        }`}
        aria-label={saved ? "Remove from favorites" : "Save to favorites"}
      >
        <Heart className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
      </button>
      <button
        type="button"
        onClick={onShare}
        className="w-9 h-9 rounded-full bg-white/95 text-navy-800 flex items-center justify-center hover:bg-gold-500 hover:text-white transition"
        aria-label="Share listing"
      >
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  );
}
