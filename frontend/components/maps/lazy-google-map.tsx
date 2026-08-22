"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

interface LazyGoogleMapProps {
  src: string;
  title: string;
  className?: string;
  placeholderClassName?: string;
  /** If true, only load iframe after the user clicks (lighter homepage). */
  clickToLoad?: boolean;
}

export function LazyGoogleMap({
  src,
  title,
  className = "",
  placeholderClassName = "",
  clickToLoad = false,
}: LazyGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (clickToLoad || shouldLoad) return;
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "80px", threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [clickToLoad, shouldLoad]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      {shouldLoad ? (
        <iframe
          title={title}
          src={src}
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShouldLoad(true)}
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-navy-800 ${placeholderClassName}`}
          aria-label={`Load map: ${title}`}
        >
          <MapPin className="w-6 h-6 text-gold-500" />
          <span className="text-xs sm:text-sm font-semibold">Load map</span>
        </button>
      )}
    </div>
  );
}
