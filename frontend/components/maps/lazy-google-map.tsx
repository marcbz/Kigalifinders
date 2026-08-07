"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

interface LazyGoogleMapProps {
  src: string;
  title: string;
  className?: string;
  placeholderClassName?: string;
}

export function LazyGoogleMap({ src, title, className = "", placeholderClassName = "" }: LazyGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || shouldLoad) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px", threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

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
          className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-navy-800 ${placeholderClassName}`}
          aria-label={`Load map: ${title}`}
        >
          <MapPin className="w-8 h-8 text-gold-500" />
          <span className="text-sm font-semibold">Load map</span>
        </button>
      )}
    </div>
  );
}
