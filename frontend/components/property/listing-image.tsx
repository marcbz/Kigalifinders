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
  const optimized = optimizeListingImageUrl(
    src || placeholder,
    optimizeWidth ?? widthFromSizes(props.sizes),
  );
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [optimized]);

  const current = failedSrc === optimized ? placeholder : optimized;
  const bypass = shouldBypassNextImageOptimizer(current);

  return (
    <Image
      {...props}
      src={current}
      alt={alt}
      unoptimized={unoptimized ?? bypass}
      onError={(event) => {
        if (optimized !== placeholder) {
          setFailedSrc(optimized);
        }
        onError?.(event);
      }}
    />
  );
}
