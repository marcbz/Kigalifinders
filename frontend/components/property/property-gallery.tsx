"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface GalleryImage {
  id: string;
  url: string;
  alt_text?: string;
}

const AUTO_SCROLL_MS = 4000;

export function PropertyGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el || !el.children[index]) return;
    const child = el.children[index] as HTMLElement;
    const offset = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
    el.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
  }, []);

  const scroll = (dir: "left" | "right") => {
    if (images.length <= 1) return;
    const next = dir === "left" ? (activeIndex - 1 + images.length) % images.length : (activeIndex + 1) % images.length;
    setActiveIndex(next);
    scrollToIndex(next);
  };

  useEffect(() => {
    if (images.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % images.length;
        scrollToIndex(next);
        return next;
      });
    }, AUTO_SCROLL_MS);
    return () => window.clearInterval(timer);
  }, [images.length, paused, scrollToIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const children = Array.from(el.children) as HTMLElement[];
      const center = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      children.forEach((child, i) => {
        const childCenter = child.offsetLeft + child.clientWidth / 2;
        const dist = Math.abs(center - childCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      setActiveIndex(closest);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [images.length]);

  return (
    <div className="mb-10">
      <div
        className="relative group"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((img, index) => (
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
                priority={index === 0}
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-navy-800 shadow-lg flex items-center justify-center opacity-80 md:opacity-0 md:group-hover:opacity-100 transition"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-navy-800 shadow-lg flex items-center justify-center opacity-80 md:opacity-0 md:group-hover:opacity-100 transition"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="flex justify-center gap-2 mt-4">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  aria-label={`Go to image ${i + 1}`}
                  onClick={() => {
                    setActiveIndex(i);
                    scrollToIndex(i);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    i === activeIndex ? "w-6 bg-gold-500" : "w-2 bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
