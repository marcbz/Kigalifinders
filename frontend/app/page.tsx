import { Suspense } from "react";
import dynamic from "next/dynamic";
import { preload } from "react-dom";
import { fetchHomepageSafe } from "@/lib/server-api";
import { HeroShell, HeroCopyFallback } from "@/features/home/hero-section";
import { HeroCopyFromApi } from "@/features/home/hero-copy-from-api";
import { SearchBar } from "@/components/search/search-bar";
import { SearchBarPlaceholder } from "@/components/search/search-bar-placeholder";
import { StatsSection } from "@/features/home/stats-section";
import { PropertyGridSection, PlotsSection, AreasSection, FurnishedSection } from "@/features/home/property-sections";
import { WhyUsSection, TestimonialsSection } from "@/features/home/why-us-section";
import { BlogSection, CTASection, MapSection } from "@/features/home/content-sections";
import { DEFAULT_HERO_IMAGE } from "@/lib/hero-image";

const FAQSection = dynamic(
  () => import("@/features/home/faq-section").then((mod) => mod.FAQSection),
  { loading: () => <div className="py-20" aria-hidden /> },
);

const NewsletterSection = dynamic(
  () => import("@/features/home/newsletter-section").then((mod) => mod.NewsletterSection),
  { loading: () => <div className="py-16" aria-hidden /> },
);

export const revalidate = 120;

function ApiErrorBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm text-center py-3 px-4">
      We&apos;re having trouble loading live listings. Please refresh in a moment or check back shortly.
    </div>
  );
}

async function HomePageSections() {
  const { data, ok } = await fetchHomepageSafe();

  const settings = data.settings || {};
  const links = data.links || {};
  const bookingUrl = links.booking_url || settings.booking_url;
  const consultationUrl = links.book_consultation_url || bookingUrl;
  const phone = links.phone || settings.phone;
  const whatsapp = links.whatsapp || settings.whatsapp;

  return (
    <>
      {!ok && <ApiErrorBanner />}
      <Suspense fallback={<SearchBarPlaceholder />}>
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

function HomeSectionsFallback() {
  return (
    <>
      <SearchBarPlaceholder />
      <div className="py-20 px-6 bg-cream dark:bg-secondary min-h-[320px]" aria-hidden />
    </>
  );
}

export default function HomePage() {
  preload(DEFAULT_HERO_IMAGE, { as: "image", fetchPriority: "high" });

  return (
    <>
      <HeroShell backgroundImage={DEFAULT_HERO_IMAGE}>
        <Suspense fallback={<HeroCopyFallback />}>
          <HeroCopyFromApi />
        </Suspense>
      </HeroShell>
      <Suspense fallback={<HomeSectionsFallback />}>
        <HomePageSections />
      </Suspense>
    </>
  );
}
