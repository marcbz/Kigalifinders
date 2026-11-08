import { SITE_BOOKING_URL } from "@/lib/site-defaults";

/** Remap legacy Setmore links (and empty values) to the on-site Whop checkout. */
export function resolveBookingUrl(url?: string | null): string {
  const trimmed = url?.trim();
  if (!trimmed) return SITE_BOOKING_URL;
  if (/setmore\.com/i.test(trimmed)) return SITE_BOOKING_URL;
  return trimmed;
}

export function isInternalBookingUrl(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}
