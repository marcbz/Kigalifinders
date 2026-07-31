import { SiteChrome } from "@/components/layout/site-chrome";
import { fetchHomepage } from "@/lib/server-api";

export async function SiteChromeWithSettings({ children }: { children: React.ReactNode }) {
  let phone = process.env.NEXT_PUBLIC_PHONE || "+250784806641";
  let whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "250784806641";

  try {
    const data = await fetchHomepage();
    if (data.settings?.phone) phone = data.settings.phone;
    if (data.settings?.whatsapp) whatsapp = data.settings.whatsapp;
  } catch {
    // use env fallbacks
  }

  return (
    <SiteChrome phone={phone} whatsapp={whatsapp}>
      {children}
    </SiteChrome>
  );
}
