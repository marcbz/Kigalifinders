"use client";

import { MapPin } from "lucide-react";

interface PropertyMapProps {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  title: string;
}

export function PropertyMap({ latitude, longitude, address, title }: PropertyMapProps) {
  const hasCoords = latitude != null && longitude != null;
  const query = hasCoords
    ? `${latitude},${longitude}`
    : address?.trim()
      ? encodeURIComponent(address.trim())
      : null;

  if (!query) return null;

  const embedUrl = hasCoords
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
    : `https://maps.google.com/maps?q=${query}&z=15&output=embed`;

  const openUrl = hasCoords
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Location on Map</h2>
      <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-border shadow-sm">
        <div className="relative w-full aspect-[16/10] min-h-[280px] bg-gray-100 dark:bg-navy-900">
          <iframe
            title={`Map location for ${title}`}
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
      {(address || hasCoords) && (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-gold-600 hover:text-gold-500 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          {address || "Open in Google Maps"}
        </a>
      )}
    </section>
  );
}
