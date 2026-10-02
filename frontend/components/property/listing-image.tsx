"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import {
  getListingImagePlaceholder,
  optimizeListingImageUrl,
  shouldBypassNextImageOptimizer,
} from "@/lib/listing-image";

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

/**
 * Property listing image that survives Vercel Image Optimization quota limits.
 * Cloudinary URLs are served directly (with CDN transforms); broken URLs fall back.
 */
export function ListingImage({
  src,
  alt,
  optimizeWidth,
  onError,
  unoptimized,
  ...props
}: ListingImageProps) {
  const placeholder = getListingImagePlaceholder();
  const original = src || placeholder;
  const optimized = optimizeListingImageUrl(
    original,
    optimizeWidth ?? widthFromSizes(props.sizes),
  );
  // Cloudinary can reject on-the-fly transforms (e.g. 401 when the transformation
  // quota is exhausted) while the untransformed original still serves fine.
  const candidates = Array.from(new Set([optimized, original, placeholder]));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [optimized]);

  const current = candidates[Math.min(attempt, candidates.length - 1)];
  const bypass = shouldBypassNextImageOptimizer(current);

  return (
    <Image
      {...props}
      key={current}
      src={current}
      alt={alt}
      unoptimized={unoptimized ?? bypass}
      onError={(event) => {
        if (attempt < candidates.length - 1) {
          setAttempt(attempt + 1);
        }
        onError?.(event);
      }}
    />
  );
}
