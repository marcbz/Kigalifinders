import { Suspense } from "react";
import { getCachedHomepage } from "@/lib/server-api";
import { HeroSection } from "@/features/home/hero-section";
import { SearchBar } from "@/components/search/search-bar";
import { StatsSection } from "@/features/home/stats-section";
import { PropertyGridSection, PlotsSection, AreasSection, FurnishedSection } from "@/features/home/property-sections";
import { WhyUsSection, TestimonialsSection } from "@/features/home/why-us-section";
import {
  BlogSection,
  FAQSection,
  CTASection,
  NewsletterSection,
  MapSection,
} from "@/features/home/content-sections";
import type { HomepageData } from "@/types";

const emptyHomepage: HomepageData = {
  stats: { properties_listed: 1200, happy_clients: 850, years_experience: 10, client_rating: 4.9 },
  featured_properties: [],
  featured_furnished: [],
  featured_plots: [],
  testimonials: [],
  districts: [],
  neighborhoods: [],
  blog_posts: [],
  faqs: [],
  hero: {},
  settings: {},
};

export default async function HomePage() {
  let data: HomepageData = emptyHomepage;
  try {
    data = await getCachedHomepage();
  } catch {
    data = emptyHomepage;
  }

  const settings = data.settings || {};
  const hero = data.hero || {};

  return (
    <>
      <HeroSection
        tagline={hero.tagline}
        title={hero.title}
        subtitle={hero.subtitle}
        backgroundImage={hero.background_image}
        ctaPrimary={hero.cta_primary}
        ctaSecondary={hero.cta_secondary}
        bookingUrl={settings.booking_url}
      />
      <Suspense fallback={<div className="h-40 -mt-16" />}>
        <SearchBar />
      </Suspense>
      <StatsSection stats={data.stats} />
      <PropertyGridSection
        title="Featured Properties"
        subtitle="Hand-picked premium homes available right now across Kigali's most desirable neighborhoods."
        properties={data.featured_properties}
      />
      <FurnishedSection properties={data.featured_furnished || []} />
      <PlotsSection properties={data.featured_plots} />
      <WhyUsSection />
      <TestimonialsSection testimonials={data.testimonials} />
      <AreasSection neighborhoods={data.neighborhoods.length ? data.neighborhoods : data.districts} />
      <MapSection
        address={settings.address}
        phone={settings.phone}
        hours={settings.hours}
        latitude={settings.latitude as number | undefined}
        longitude={settings.longitude as number | undefined}
      />
      <BlogSection posts={data.blog_posts} />
      <FAQSection faqs={data.faqs} />
      <CTASection bookingUrl={settings.booking_url} whatsapp={settings.whatsapp} />
      <NewsletterSection />
    </>
  );
}
