export const SITE_ADDRESS = "KG 11 Ave, Kigali";
export const SITE_STREET_ADDRESS = "KG 11 Ave";
/** Same plus code as the Google Business Profile pin. */
export const SITE_PLUS_CODE = "342G+G8 Kigali";
/** Centre of plus code 6GCG342G+G8 (342G+G8 Kigali). */
export const SITE_GEO = { latitude: -1.9486875, longitude: 30.1258125 } as const;
export const SITE_PHONE = "+250784806641";
export const SITE_HOURS = "Mon - Sat: 9:00 AM - 5:00 PM";
/** On-site Whop checkout page — replaces the old Setmore booking link. */
export const SITE_BOOKING_URL = "/book";
export const WHOP_CHECKOUT_PLAN = "plan_D8Jjmi7IllYYR";
/** Whop plan for the private $200 service payment page (/pay). Set via env after creating the product. */
export const WHOP_SERVICE_PAYMENT_PLAN =
  process.env.NEXT_PUBLIC_WHOP_SERVICE_PLAN || "plan_REPLACE_WITH_SERVICE_PLAN";
export const SITE_SERVICE_PAYMENT_URL = "/pay";


export const SITE_SOCIAL = {
  facebook: "https://facebook.com/kigalirent",
  instagram: "https://instagram.com/kigalirent",
  linkedin: "https://www.linkedin.com/company/kigalirent/",
  youtube: "https://youtube.com/@kigalirent",
  tiktok: "https://www.tiktok.com/@kigalirent",
} as const;
