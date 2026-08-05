import { Suspense } from "react";
import { fetchHomepageSafe } from "@/lib/server-api";
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

export const revalidate = 120;

function ApiErrorBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm text-center py-3 px-4">
      We&apos;re having trouble loading live listings. Please refresh in a moment or check back shortly.
    </div>
  );
}

export default async function HomePage() {
  const { data, ok } = await fetchHomepageSafe();

  const settings = data.settings || {};
  const links = data.links || {};
  const hero = data.hero || {};
  const bookingUrl = links.booking_url || settings.booking_url;
  const consultationUrl = links.book_consultation_url || bookingUrl;
  const phone = links.phone || settings.phone;
  const whatsapp = links.whatsapp || settings.whatsapp;

  return (
    <>
      {!ok && <ApiErrorBanner />}
      <HeroSection
        tagline={hero.tagline}
        title={hero.title}
        subtitle={hero.subtitle}
        backgroundImage={hero.background_image}
        ctaPrimary={hero.cta_primary}
        ctaSecondary={hero.cta_secondary}
        bookingUrl={bookingUrl}
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
        phone={phone}
        hours={settings.hours}
        latitude={settings.latitude}
        longitude={settings.longitude}
      />
      <BlogSection posts={data.blog_posts} />
      <FAQSection faqs={data.faqs} />
      <CTASection bookingUrl={consultationUrl} whatsapp={whatsapp} />
      <NewsletterSection />
    </>
  );
}
