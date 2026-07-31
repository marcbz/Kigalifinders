"use client";

import { useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

interface GalleryImage {
  id: string;
  url: string;
  alt_text?: string;
}

export function PropertyGallery({
  images,
  title,
  latitude,
  longitude,
  address,
}: {
  images: GalleryImage[];
  title: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const mapUrl =
    latitude && longitude
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : null;

  return (
    <div className="mb-10">
      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((img) => (
            <div
              key={img.id}
              className="relative flex-shrink-0 w-full md:w-[85%] lg:w-[70%] h-[320px] md:h-[480px] lg:h-[560px] rounded-2xl overflow-hidden snap-center"
            >
              <Image
                src={img.url}
                alt={img.alt_text || title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 70vw"
                priority={images[0]?.id === img.id}
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-navy-800 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-navy-800 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      {mapUrl && (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold-600 hover:text-gold-500"
        >
          <MapPin className="w-4 h-4" />
          View exact location on map
        </a>
      )}
    </div>
  );
}
