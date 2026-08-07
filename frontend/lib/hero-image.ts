export const DEFAULT_HERO_IMAGE = "/images/hero-kigali.webp";
export const DEFAULT_HERO_IMAGE_MOBILE = "/images/hero-kigali-mobile.webp";

const LEGACY_HERO_PATTERNS = ["talosluxuryvillas.com", "/29.jpg"];

export function resolveHeroImage(url?: string | null): string {
  const trimmed = url?.trim();
  if (!trimmed) return DEFAULT_HERO_IMAGE;
  if (LEGACY_HERO_PATTERNS.some((pattern) => trimmed.includes(pattern))) {
    return DEFAULT_HERO_IMAGE;
  }
  return trimmed;
}
