import { MapPin } from "lucide-react";
import { LazyGoogleMap } from "@/components/maps/lazy-google-map";

interface PropertyMapProps {
  address?: string | null;
  title: string;
}

export function PropertyMap({ address, title }: PropertyMapProps) {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  const query = encodeURIComponent(trimmed);
  const embedUrl = `https://maps.google.com/maps?q=${query}&z=15&output=embed`;
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Location on Map</h2>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="relative w-full max-w-[280px] aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-border shadow-md shrink-0">
          <LazyGoogleMap title={`Map location for ${title}`} src={embedUrl} />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-1">
          <p className="mb-3 leading-relaxed">{trimmed}</p>
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
