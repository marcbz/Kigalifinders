/** Listing image helpers — keep Cloudinary off Vercel's Image Optimization quota. */

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800";

const CLOUDINARY_HOSTS = new Set(["res.cloudinary.com"]);

/** Optional: when set, only this cloud gets on-the-fly transforms (avoids 401 on foreign clouds). */
const OUR_CLOUDINARY_CLOUD = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "").trim();

export function getListingImagePlaceholder(): string {
  return PLACEHOLDER;
}

export function cloudinaryCloudFromUrl(src: string): string | null {
  try {
    const host = new URL(src).hostname.toLowerCase();
    if (!CLOUDINARY_HOSTS.has(host) && !host.endsWith(".cloudinary.com")) return null;
    const parts = new URL(src).pathname.split("/").filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

export function isCloudinaryUrl(src: string): boolean {
  return cloudinaryCloudFromUrl(src) != null;
}

export function isOurCloudinaryUrl(src: string): boolean {
  if (!OUR_CLOUDINARY_CLOUD) return false;
  return cloudinaryCloudFromUrl(src) === OUR_CLOUDINARY_CLOUD;
}

/**
 * New listing photos hit Vercel Image Optimization as new source images.
 * When the plan quota is exhausted, `/_next/image` returns 402 and cards show alt text.
 * Cloudinary already optimizes delivery — bypass Next's optimizer for those URLs.
 *
 * Also bypass for any other remote HTTPS host: Next only allowlists a few domains in
 * next.config.js, so pasted realtor / foreign-CDN URLs would otherwise always 404 and
 * fall back to the placeholder house image.
 */
export function shouldBypassNextImageOptimizer(src: string): boolean {
  if (isCloudinaryUrl(src)) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Inject responsive Cloudinary transforms so we still get sized/webp delivery
 * without paying Vercel optimization units.
 *
 * Only rewrite URLs on *our* Cloudinary cloud. Foreign clouds (or disabled accounts)
 * often reject unsigned transforms with 401, and a disabled cloud_name returns 401 for
 * every delivery — transforms cannot fix that; the photo must be re-uploaded to our account.
 */
export function optimizeListingImageUrl(src: string, width = 800): string {
  if (!src) return PLACEHOLDER;
  if (!isCloudinaryUrl(src)) return src;
  // Without the public cloud name, skip transforms — originals still load for our uploads.
  if (OUR_CLOUDINARY_CLOUD && !isOurCloudinaryUrl(src)) return src;
  if (!src.includes("/image/upload/")) return src;

  // Already transformed
  if (/\/image\/upload\/(?:[^/]+,)*f_auto/.test(src)) return src;

  const transform = `f_auto,q_auto,c_limit,w_${Math.max(320, Math.min(width, 1920))}`;
  return src.replace("/image/upload/", `/image/upload/${transform}/`);
}
