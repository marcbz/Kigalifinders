"use client";

import { Share2 } from "lucide-react";
import type { PropertyListItem } from "@/types";

export function PropertyCardActions({ property }: { property: PropertyListItem }) {
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
        onClick={onShare}
        className="w-9 h-9 rounded-full bg-white/95 text-navy-800 flex items-center justify-center hover:bg-gold-500 hover:text-white transition"
        aria-label="Share listing"
      >
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  );
}
