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
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="relative w-52 h-52 md:w-60 md:h-60 rounded-full overflow-hidden border-4 border-gold-500/25 shadow-lg shrink-0 bg-gray-100 dark:bg-navy-900">
          <iframe
            title={`Map location for ${title}`}
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0 scale-[1.4] origin-center"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {address && <p className="mb-3 leading-relaxed">{address}</p>}
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold text-gold-600 hover:text-gold-500 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Open in Google Maps
          </a>
        </div>
      </div>
    </section>
  );
}
