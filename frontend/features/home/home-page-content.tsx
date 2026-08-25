import dynamic from "next/dynamic";
import { fetchHomepageSafe } from "@/lib/server-api";
import { StatsSection } from "@/features/home/stats-section";
import { RecentlyViewedHomeStrip } from "@/features/home/recently-viewed-home-strip";

const PropertyGridSection = dynamic(
  () => import("@/features/home/property-sections").then((mod) => mod.PropertyGridSection),
  { loading: () => <div className="py-20 px-6 min-h-[480px] bg-cream dark:bg-secondary" aria-hidden /> },
);

const FurnishedSection = dynamic(
  () => import("@/features/home/property-sections").then((mod) => mod.FurnishedSection),
  { loading: () => null },
);

const PlotsSection = dynamic(
  () => import("@/features/home/property-sections").then((mod) => mod.PlotsSection),
  { loading: () => null },
);

const WhyUsSection = dynamic(
  () => import("@/features/home/why-us-section").then((mod) => mod.WhyUsSection),
  { loading: () => <div className="py-24" aria-hidden /> },
);

const TestimonialsSection = dynamic(
  () => import("@/features/home/why-us-section").then((mod) => mod.TestimonialsSection),
  { loading: () => <div className="py-20" aria-hidden /> },
);

const AreasSection = dynamic(
  () => import("@/features/home/property-sections").then((mod) => mod.AreasSection),
  { loading: () => <div className="py-20" aria-hidden /> },
);

const MapSection = dynamic(
  () => import("@/features/home/content-sections").then((mod) => mod.MapSection),
  { loading: () => <div className="py-20" aria-hidden /> },
);

const BlogSection = dynamic(
  () => import("@/features/home/content-sections").then((mod) => mod.BlogSection),
  { loading: () => <div className="py-20" aria-hidden /> },
);

const FAQSection = dynamic(
  () => import("@/features/home/faq-section").then((mod) => mod.FAQSection),
  { loading: () => <div className="py-20" aria-hidden /> },
);

const CTASection = dynamic(
  () => import("@/features/home/content-sections").then((mod) => mod.CTASection),
  { loading: () => <div className="py-24" aria-hidden /> },
);

function ApiErrorBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm text-center py-3 px-4">
      We&apos;re having trouble loading live listings. Please refresh in a moment or check back shortly.
    </div>
  );
}

export function HomePageFallback() {
  return <div className="py-20 px-6 bg-cream dark:bg-secondary min-h-[320px]" aria-hidden />;
}

export async function HomePageContent() {
  const { data, ok } = await fetchHomepageSafe();

  const settings = data.settings || {};
  const links = data.links || {};
  const consultationUrl = links.book_consultation_url || links.booking_url || settings.booking_url;
  const phone = links.phone || settings.phone;
  const whatsapp = links.whatsapp || settings.whatsapp;

  const faqJsonLd =
    data.faqs?.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: data.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: String(faq.answer || "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim(),
            },
          })),
        }
      : null;

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      {!ok && <ApiErrorBanner />}
      <StatsSection stats={data.stats} />
      <RecentlyViewedHomeStrip />
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
    </>
  );
}
