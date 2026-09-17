/** Listing image helpers — keep Cloudinary off Vercel's Image Optimization quota. */

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800";

const CLOUDINARY_HOSTS = new Set(["res.cloudinary.com"]);

export function getListingImagePlaceholder(): string {
  return PLACEHOLDER;
}

export function isCloudinaryUrl(src: string): boolean {
  try {
    const host = new URL(src).hostname.toLowerCase();
    return CLOUDINARY_HOSTS.has(host) || host.endsWith(".cloudinary.com");
  } catch {
    return false;
  }
}

/**
 * New listing photos hit Vercel Image Optimization as new source images.
 * When the plan quota is exhausted, `/_next/image` returns 402 and cards show alt text.
 * Cloudinary already optimizes delivery — bypass Next's optimizer for those URLs.
 */
export function shouldBypassNextImageOptimizer(src: string): boolean {
  return isCloudinaryUrl(src);
}

/**
 * Inject responsive Cloudinary transforms so we still get sized/webp delivery
 * without paying Vercel optimization units.
 */
export function optimizeListingImageUrl(src: string, width = 800): string {
  if (!src || !isCloudinaryUrl(src)) return src || PLACEHOLDER;
  if (!src.includes("/image/upload/")) return src;

  // Already transformed
  if (/\/image\/upload\/(?:[^/]+,)*f_auto/.test(src)) return src;

  const transform = `f_auto,q_auto,c_limit,w_${Math.max(320, Math.min(width, 1920))}`;
  return src.replace("/image/upload/", `/image/upload/${transform}/`);
}
