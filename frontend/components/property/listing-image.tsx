"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";
import {
  optimizeListingImageUrl,
  shouldBypassNextImageOptimizer,
} from "@/lib/listing-image";
import { cn } from "@/lib/utils";

type ListingImageProps = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  alt: string;
  /** Target width for Cloudinary `w_` transform (defaults from sizes when possible). */
  optimizeWidth?: number;
};

function widthFromSizes(sizes?: string | number): number {
  if (typeof sizes === "number") return sizes;
  return 800;
}

function ListingImageUnavailable({
  alt,
  fill,
  className,
}: {
  alt: string;
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt ? `${alt} — photo unavailable` : "Photo unavailable"}
      className={cn(
        "flex flex-col items-center justify-center gap-2 bg-navy-800 text-white/65 pointer-events-none select-none",
        fill ? "absolute inset-0 h-full w-full" : "h-full w-full min-h-[12rem]",
        className?.includes("object-") ? undefined : className,
      )}
    >
      <ImageOff className="h-8 w-8 opacity-50" aria-hidden />
      <span className="px-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em]">
        Photo unavailable
      </span>
    </div>
  );
}

/**
 * Property listing image that survives Vercel Image Optimization quota limits.
 * Cloudinary URLs are served directly (with CDN transforms). Missing or broken
 * URLs show a neutral empty state — never a stock house photo.
 */
export function ListingImage({
  src,
  alt,
  optimizeWidth,
  onError,
  unoptimized,
  fill,
  className,
  ...props
}: ListingImageProps) {
  const original = (src || "").trim();
  const optimized = original
    ? optimizeListingImageUrl(
        original,
        optimizeWidth ?? widthFromSizes(props.sizes),
      )
    : "";
  // Cloudinary can reject on-the-fly transforms (e.g. 401 when the transformation
  // quota is exhausted) while the untransformed original still serves fine.
  const candidates = original
    ? Array.from(new Set([optimized, original].filter(Boolean)))
    : [];
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(!original);

  useEffect(() => {
    setAttempt(0);
    setFailed(!original);
  }, [optimized, original]);

  if (failed || candidates.length === 0) {
    return <ListingImageUnavailable alt={alt} fill={fill} className={className} />;
  }

  const current = candidates[Math.min(attempt, candidates.length - 1)];
  const bypass = shouldBypassNextImageOptimizer(current);

  return (
    <Image
      {...props}
      key={current}
      src={current}
      alt={alt}
      fill={fill}
      className={className}
      unoptimized={unoptimized ?? bypass}
      onError={(event) => {
        if (attempt < candidates.length - 1) {
          setAttempt(attempt + 1);
        } else {
          setFailed(true);
        }
        onError?.(event);
      }}
    />
  );
}
