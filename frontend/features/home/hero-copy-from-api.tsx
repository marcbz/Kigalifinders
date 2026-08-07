import { fetchHomepageSafe } from "@/lib/server-api";
import { HeroCopy } from "@/features/home/hero-section";

export async function HeroCopyFromApi() {
  const { data } = await fetchHomepageSafe();
  const hero = data.hero || {};
  const links = data.links || {};
  const settings = data.settings || {};
  const bookingUrl = links.booking_url || settings.booking_url;

  return (
    <HeroCopy
      tagline={hero.tagline}
      title={hero.title}
      subtitle={hero.subtitle}
      ctaPrimary={hero.cta_primary}
      ctaSecondary={hero.cta_secondary}
      bookingUrl={bookingUrl}
    />
  );
}
