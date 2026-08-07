"use client";

import { ArrowLeftRight, Heart, Share2 } from "lucide-react";

const actions = [
  { Icon: Heart, label: "Save" },
  { Icon: ArrowLeftRight, label: "Compare" },
  { Icon: Share2, label: "Share" },
] as const;

export function PropertyCardActions() {
  return (
    <div className="absolute top-3.5 right-3.5 flex gap-2 z-10 pointer-events-auto">
      {actions.map(({ Icon, label }) => (
        <button
          key={label}
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="w-9 h-9 rounded-full bg-white/95 text-navy-800 flex items-center justify-center hover:bg-gold-500 hover:text-white transition"
          aria-label={label}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
