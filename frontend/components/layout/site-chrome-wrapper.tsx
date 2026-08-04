import { SiteChrome } from "@/components/layout/site-chrome";
import { fetchHomepageSafe } from "@/lib/server-api";

export async function SiteChromeWithSettings({ children }: { children: React.ReactNode }) {
  const defaults = {
    phone: process.env.NEXT_PUBLIC_PHONE || "+250 784 806 641",
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "250784806641",
    address: "KN 4 St, Kigali, Rwanda",
    hours: "Mon - Sat: 8:00 AM - 7:00 PM",
    bookingUrl: "https://secure-guard.setmore.com/",
    consultationUrl: "https://secure-guard.setmore.com/",
  };

  let phone = defaults.phone;
  let whatsapp = defaults.whatsapp;
  let address = defaults.address;
  let hours = defaults.hours;
  let bookingUrl = defaults.bookingUrl;
  let consultationUrl = defaults.consultationUrl;

  try {
    const { data } = await fetchHomepageSafe();
    const site = data.settings || {};
    const links = data.links || {};
    if (links.phone || site.phone) phone = links.phone || site.phone || phone;
    if (links.whatsapp || site.whatsapp) whatsapp = links.whatsapp || site.whatsapp || whatsapp;
    if (site.address) address = site.address;
    if (site.hours) hours = site.hours;
    if (links.booking_url || site.booking_url) bookingUrl = links.booking_url || site.booking_url || bookingUrl;
    if (links.book_consultation_url) consultationUrl = links.book_consultation_url;
    else if (links.booking_url || site.booking_url) consultationUrl = links.booking_url || site.booking_url || consultationUrl;
  } catch {
    // use defaults
  }

  return (
    <SiteChrome
      phone={phone}
      whatsapp={whatsapp}
      address={address}
      hours={hours}
      bookingUrl={bookingUrl}
      consultationUrl={consultationUrl}
    >
      {children}
    </SiteChrome>
  );
}
