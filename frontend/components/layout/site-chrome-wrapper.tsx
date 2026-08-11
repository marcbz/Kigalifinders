import { SiteChrome } from "@/components/layout/site-chrome";
import { SITE_ADDRESS, SITE_HOURS } from "@/lib/site-defaults";

const DEFAULTS = {
  phone: process.env.NEXT_PUBLIC_PHONE || "+250 784 806 641",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "250784806641",
  address: SITE_ADDRESS,
  hours: SITE_HOURS,
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL || "https://secure-guard.setmore.com/",
  consultationUrl: process.env.NEXT_PUBLIC_BOOKING_URL || "https://secure-guard.setmore.com/",
};

/** Renders immediately with env defaults — no API fetch blocking the document shell. */
export function SiteChromeWithSettings({ children }: { children: React.ReactNode }) {
  return (
    <SiteChrome
      phone={DEFAULTS.phone}
      whatsapp={DEFAULTS.whatsapp}
      address={DEFAULTS.address}
      hours={DEFAULTS.hours}
      bookingUrl={DEFAULTS.bookingUrl}
      consultationUrl={DEFAULTS.consultationUrl}
      social={{}}
    >
      {children}
    </SiteChrome>
  );
}
